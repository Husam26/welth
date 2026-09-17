"use server";

import { db } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/serialize";
import { mean } from "@/lib/stats";
import { defaultCategories } from "@/data/categories";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Valid EXPENSE category ids (per-category budgets only apply to expenses)
const EXPENSE_CATEGORY_IDS = defaultCategories
  .filter((c) => c.type === "EXPENSE")
  .map((c) => c.id);

const categoryBudgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_IDS, {
    errorMap: () => ({ message: "Unknown expense category" }),
  }),
  amount: z.coerce.number().positive("Budget amount must be greater than 0"),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
});

// Resolve the authenticated app user (throws if not signed in / not found)
async function getAuthedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

function currentMonthRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth, now };
}

export async function getCategoryBudgets() {
  const user = await getAuthedUser();
  const budgets = await db.categoryBudget.findMany({
    where: { userId: user.id },
    orderBy: { category: "asc" },
  });
  return budgets.map(serializeDecimal);
}

export async function upsertCategoryBudget(data) {
  try {
    const user = await getAuthedUser();

    const parsed = categoryBudgetSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.errors[0]?.message || "Invalid budget data");
    }
    const { category, amount, period } = parsed.data;

    const budget = await db.categoryBudget.upsert({
      where: { userId_category: { userId: user.id, category } },
      update: { amount, period },
      create: { userId: user.id, category, amount, period },
    });

    revalidatePath("/budgets");
    revalidatePath("/dashboard");
    return { success: true, data: serializeDecimal(budget) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteCategoryBudget(category) {
  try {
    const user = await getAuthedUser();

    // Ownership is enforced by the composite key (userId + category)
    await db.categoryBudget.deleteMany({
      where: { userId: user.id, category },
    });

    revalidatePath("/budgets");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Per-category budget vs. actual spend for the current month.
 * Returns one row per category that has either a budget or spend this month.
 */
export async function getBudgetOverview() {
  const user = await getAuthedUser();
  const { startOfMonth, endOfMonth } = currentMonthRange();

  const [budgets, grouped] = await Promise.all([
    db.categoryBudget.findMany({ where: { userId: user.id } }),
    db.transaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = Object.fromEntries(
    grouped.map((g) => [g.category, g._sum.amount ? g._sum.amount.toNumber() : 0])
  );
  const budgetByCategory = Object.fromEntries(
    budgets.map((b) => [b.category, b.amount.toNumber()])
  );

  // Union of categories that have a budget and/or spend this month
  const categories = new Set([
    ...Object.keys(budgetByCategory),
    ...Object.keys(spentByCategory),
  ]);

  const overview = [...categories].map((category) => {
    const budget = budgetByCategory[category] ?? null;
    const spent = spentByCategory[category] ?? 0;
    const remaining = budget !== null ? budget - spent : null;
    const pct = budget && budget > 0 ? Math.min((spent / budget) * 100, 100) : null;

    let status = "no-budget";
    if (budget !== null) {
      if (spent > budget) status = "over";
      else if (pct >= 80) status = "warning";
      else status = "ok";
    }

    return { category, budget, spent, remaining, pct, status };
  });

  // Sort: budgeted categories first, then by spend desc
  overview.sort((a, b) => {
    if ((a.budget !== null) !== (b.budget !== null)) return a.budget !== null ? -1 : 1;
    return b.spent - a.spent;
  });

  return overview;
}

/**
 * Suggest a monthly budget per expense category based on the user's average
 * monthly spend over the last 3 full months (rounded to a sensible figure).
 */
export async function suggestCategoryBudgets() {
  const user = await getAuthedUser();

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const transactions = await db.transaction.findMany({
    where: {
      userId: user.id,
      type: "EXPENSE",
      date: { gte: start, lte: end },
    },
    select: { category: true, amount: true, date: true },
  });

  if (transactions.length === 0) {
    return { success: true, data: [], message: "Not enough history to suggest budgets yet." };
  }

  // Sum per category per month, then average the monthly totals
  const perCategoryMonthly = {};
  for (const t of transactions) {
    const monthKey = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    perCategoryMonthly[t.category] ??= {};
    perCategoryMonthly[t.category][monthKey] =
      (perCategoryMonthly[t.category][monthKey] || 0) + t.amount.toNumber();
  }

  const suggestions = Object.entries(perCategoryMonthly).map(([category, months]) => {
    const monthlyTotals = Object.values(months);
    const avg = mean(monthlyTotals);
    // Round up to the nearest 100 for a clean, slightly-generous target
    const suggested = Math.ceil(avg / 100) * 100;
    return { category, suggested, basedOnMonths: monthlyTotals.length };
  });

  suggestions.sort((a, b) => b.suggested - a.suggested);
  return { success: true, data: suggestions };
}
