'use server'

import { db } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/serialize";
import { accountSchema } from "@/app/lib/schema";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createAccount (data){
    try {
        const {userId} = await auth();
        if(!userId) throw new Error("Unauthorized");

        // Validate the incoming payload server-side (never trust the client)
        const parsed = accountSchema.safeParse(data);
        if (!parsed.success) {
            throw new Error(parsed.error.errors[0]?.message || "Invalid account data");
        }
        data = parsed.data;

        const user = await db.user.findUnique({
            where : {
                clerkUserId : userId
            },
        });

        if(!user){
            throw new Error ("User not found")
        }

        //convert balance to float before saving

        const balanceFloat = parseFloat(data.balance)

        if(isNaN(balanceFloat)){
            throw new Error ("Invalid balance amount");
        }

        //Check if it is users 1st account
        const existingAccounts = await db.account.findMany({
            where : {
                userId : user.id
            },
        });

        const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault;

        //If this account should be default , unset other default accounts

        if(shouldBeDefault){
            await db.account.updateMany({
                where : {userId : user.id, isDefault : true},
                data : {isDefault : false},
            });
        }

        const account = await db.account.create({
            data : {
                ...data,
                balance : balanceFloat,
                userId : user.id,
                isDefault : shouldBeDefault,
            },
        });


        const serializedAccount = serializeDecimal(account);

        revalidatePath("/dashboard");
        return {success : true , data : serializedAccount};

    } catch (error) {
        throw new Error (error.message);
    }
}

export async function getUserAccounts(){
    const {userId} = await auth();
        if(!userId) throw new Error("Unauthorized");

        const user = await db.user.findUnique({
            where : {
                clerkUserId : userId
            },
        });

        if(!user){
            throw new Error ("User not found")
        }

        const accounts = await db.account.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            include: {
              _count: {
                select: {
                  transactions: true, // ✅ Only works if "transactions" relation exists
                },
              },
            },
          });
          
        const serializedAccount = accounts.map(serializeDecimal);

        return serializedAccount;
}

export async function getDashboardData() {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
  
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
  
    if (!user) {
      throw new Error("User not found");
    }
  
    // Get all user transactions
    const transactions = await db.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
  
    return transactions.map(serializeDecimal);
  }

  