"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";

const serializedTransaction = (obj) => {
  const serialized = { ...obj };

  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }

  return serialized;
};

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Updating default account for user:", user.id);

    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isDefault: true },
    });

    console.log("Updated default account:", account.id);

    revalidatePath("/dashboard");
    return { success: true, data: serializedTransaction(account) };
  } catch (error) {
    console.error("Error in updateDefaultAccount:", error);
    return { success: false, error: error.message };
  }
}

export async function getAccountWithTransaction(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Fetching account with transactions for user:", user.id);

    const account = await db.account.findUnique({
      where: { id: accountId, userId: user.id },
      include: {
        transactions: {
          orderBy: { date: "desc" },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!account) {
      console.log("No account found with ID:", accountId);
      return null;
    }

    console.log("Fetched account:", account.id, "Transaction count:", account._count.transactions);

    return {
      ...serializedTransaction(account),
      transactions: account.transactions.map(serializedTransaction),
    };
  } catch (error) {
    console.error("Error in getAccountWithTransaction:", error);
    return null;
  }
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Deleting transactions for user:", user.id, "Transaction IDs:", transactionIds);

    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    console.log("Fetched transactions for deletion:", transactions.length);

    if (transactions.length === 0) {
      console.log("No transactions found for deletion.");
      return { success: false, error: "No transactions found" };
    }

    const accountBalanceChanges = transactions.reduce((acc, transaction) => {
      const change =
        transaction.type === "EXPENSE"
          ? -transaction.amount
          :transaction.amount; 

      acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change;

      return acc;
    }, {});

    console.log("Account balance changes calculated:", accountBalanceChanges);

    // Delete transactions and update account balances in a transaction
    await db.$transaction(async (tx) => {
      console.log("Starting transaction deletion...");

      // Delete transactions
      await tx.transaction.deleteMany({
        where: {
          id: { in: transactionIds },
          userId: user.id,
        },
      });

      console.log("Transactions deleted successfully.");

      for (const [accountId, balanceChange] of Object.entries(accountBalanceChanges)) {
        console.log(`Updating balance for account ${accountId} by ${balanceChange}`);
        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: {
              increment: parseFloat(balanceChange),
            },
          },
        });
      }

      console.log("Account balances updated.");
    });

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    console.log("Revalidated paths after deletion.");
    return { success: true };
  } catch (error) {
    console.error("Error in bulkDeleteTransactions:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Attempting to delete account for user:", user.id, "Account ID:", accountId);

    // Find the account and ensure the user owns it
    const account = await db.account.findUnique({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new Error("Account not found or unauthorized");
    }

    // Ensure user cannot delete their only remaining account
    const userAccounts = await db.account.findMany({
      where: { userId: user.id },
    });

    if (userAccounts.length === 1) {
      throw new Error("You cannot delete your only account");
    }

    // Ensure the account is not the default one
    if (account.isDefault) {
      throw new Error("You cannot delete a default account. Set another account as default first.");
    }

    console.log("Deleting transactions linked to the account...");

    // Delete all transactions linked to this account
    await db.transaction.deleteMany({
      where: { accountId },
    });

    console.log("Transactions deleted. Proceeding to delete account...");

    // Delete the account
    await db.account.delete({
      where: { id: accountId },
    });

    console.log("Account deleted successfully:", accountId);

    // Revalidate the dashboard and account list pages
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteAccount:", error);
    return { success: false, error: error.message };
  }
}

export async function updateAccountBalance(accountId, newBalance) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Find the user in the database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Validate and sanitize newBalance
    const parsedBalance = parseFloat(newBalance);
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      throw new Error("Invalid balance amount");
    }

    // Check if the account belongs to the authenticated user
    const account = await db.account.findUnique({
      where: { id: accountId, userId: user.id },
    });

    if (!account) throw new Error("Account not found or unauthorized");

    // Update the account balance with Prisma.Decimal for precision
    const updatedAccount = await db.account.update({
      where: { id: accountId },
      data: { balance: new Decimal(parsedBalance) },
    });

    // ** Convert balance (Decimal) to a plain JS number **
    const formattedAccount = {
      ...updatedAccount,
      balance: updatedAccount.balance.toNumber(), // Convert Decimal to Number
    };

    // Revalidate the dashboard and account pages
    revalidatePath("/dashboard");
    revalidatePath(`/account/${accountId}`);

    return { success: true, data: formattedAccount };
  } catch (error) {
    console.error("Error in updateAccountBalance:", error.message);
    return { success: false, error: error.message };
  }
}