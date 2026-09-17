"use server";

import aj from "@/lib/arcjet";
import { db } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/serialize";
import { inngest } from "@/lib/inngest/client";
import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Server-side validation schema. The client form already validates via Zod, but
// server actions are a public HTTP surface and must never trust incoming data.
const transactionInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().max(255).optional().nullable(),
  date: z.coerce.date(),
  accountId: z.string().min(1, "Account is required"),
  category: z.string().min(1, "Category is required"),
  receiptUrl: z.string().url().optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringInterval: z
    .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
    .optional()
    .nullable(),
});

export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Validate & sanitize incoming payload before touching the DB
    const parsed = transactionInputSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || "Invalid transaction data");
    }
    data = parsed.data;

    //Arcjet to add rate limiting
    //get data for arcjet
    const req = await request();

    //check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests.Please try again later")
      }
      throw new Error("Request blocked")
    }

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found"); 
    }

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;

    // Create transaction and update account balance atomically.
    // Using an atomic `increment` (instead of read-then-write of an absolute
    // value) avoids a lost-update race when two transactions are created
    // concurrently on the same account.
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: balanceChange } },
      });

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    // Fire-and-forget: trigger a near-real-time anomaly scan for this user.
    // Wrapped so a messaging hiccup never fails the transaction itself.
    try {
      await inngest.send({
        name: "transaction.created",
        data: { userId: user.id, transactionId: transaction.id },
      });
    } catch (e) {
      console.error("Failed to emit transaction.created event:", e?.message);
    }

    return { success: true, data: serializeDecimal(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

//Helper function to calculate next recurring date

function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;

    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;

    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date;
}

export async function scanReceipt(file){
  try {
    const model = genAI.getGenerativeModel({model : GEMINI_MODEL});

    //Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();

    //convert arraybuffer to base64 
    const base64String  = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `Analyze this receipt image and extract the following information in JSON format:
    - Total amount (just the number)
    - Date (in ISO format)
    - Description or items purchased (brief summary)
    - Merchant/store name
    - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
    
    Only respond with valid JSON in this exact format:
    {
      "amount": number,
      "date": "ISO date string",
      "description": "string",
      "merchantName": "string",
      "category": "string"
    }

    If its not a recipt, return an empty object
  `;

    const result  = await model.generateContent([
      {
        inlineData : {
          data : base64String,
          mimeType : file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g,"").trim();

    try {
      const data = JSON.parse(cleanedText);
      return {
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        description: data.description,
        category: data.category,
        merchantName: data.merchantName,
      };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid response format from Gemini");
    }
    

  } catch (error) {
    console.error("Error scanning receipt:", error.message);
    throw new Error("Failed to scan receipt");
  }
}


export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeDecimal(transaction);
}



export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Validate & sanitize incoming payload
    const parsed = transactionInputSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || "Invalid transaction data");
    }
    data = parsed.data;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    // Update transaction and account balance in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeDecimal(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}
