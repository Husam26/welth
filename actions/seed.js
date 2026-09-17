"use server";

import { db } from "@/lib/prisma";
import { subDays } from "date-fns";
import { auth } from "@clerk/nextjs/server";
import { detectAndPersistAnomalies } from "@/lib/anomaly";
import { generateAndPersistForecasts } from "@/lib/forecast";
import { loadSimulationInputs } from "@/lib/montecarlo";
import { simulateBatch, aggregateBatches } from "@/lib/montecarlo-core";
import { hashStringToSeed } from "@/lib/stats";

// Categories with their typical amount ranges
const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

export async function seedTransactions() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: { accounts: { where: { isDefault: true } } },
    });

    if (!user) throw new Error("User not found");
    if (!user.accounts || user.accounts.length === 0) {
      throw new Error("No default account found. Please create an account first.");
    }

    const USER_ID = user.id;
    const ACCOUNT_ID = user.accounts[0].id;

    // ── 1. Generate ~90 days of transactions ──
    const transactions = [];
    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        const type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        transactions.push({
          id: crypto.randomUUID(),
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"} ${category}`,
          date,
          category,
          status: "COMPLETED",
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          createdAt: date,
          updatedAt: date,
        });
        totalBalance += type === "INCOME" ? amount : -amount;
      }
    }

    // ── 1b. Inject deliberate anomalies so the Insights page has data ──
    // A large food spike (~10x normal) two days ago -> AMOUNT_SPIKE + CATEGORY_SURGE
    const spikeAmount = 1499.0;
    transactions.push({
      id: crypto.randomUUID(),
      type: "EXPENSE",
      amount: spikeAmount,
      description: "Paid for food",
      date: subDays(new Date(), 2),
      category: "food",
      status: "COMPLETED",
      userId: USER_ID,
      accountId: ACCOUNT_ID,
      createdAt: subDays(new Date(), 2),
      updatedAt: subDays(new Date(), 2),
    });
    totalBalance -= spikeAmount;

    // A duplicate charge within 24h -> DUPLICATE_CHARGE
    for (let k = 0; k < 2; k++) {
      transactions.push({
        id: crypto.randomUUID(),
        type: "EXPENSE",
        amount: 499.0,
        description: "Paid for entertainment",
        date: subDays(new Date(), 1),
        category: "entertainment",
        status: "COMPLETED",
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        createdAt: subDays(new Date(), 1),
        updatedAt: subDays(new Date(), 1),
      });
      totalBalance -= 499.0;
    }

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { accountId: ACCOUNT_ID } });
      await tx.transaction.createMany({ data: transactions });
      await tx.account.update({
        where: { id: ACCOUNT_ID },
        data: { balance: totalBalance },
      });
    });

    // ── 2. Per-category budgets (from the generated spending) ──
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const spendByCat = {};      // 3-month total per category
    const currentByCat = {};    // current-month spend per category
    for (const t of transactions) {
      if (t.type !== "EXPENSE") continue;
      spendByCat[t.category] = (spendByCat[t.category] || 0) + t.amount;
      if (`${t.date.getFullYear()}-${t.date.getMonth()}` === monthKey) {
        currentByCat[t.category] = (currentByCat[t.category] || 0) + t.amount;
      }
    }

    // Make a couple of categories intentionally tight so budget alerts/overruns show.
    const tight = new Set(["food", "groceries"]);
    const budgetRows = Object.keys(spendByCat).map((category) => {
      const monthlyAvg = spendByCat[category] / 3;
      const current = currentByCat[category] || 0;
      const amount = tight.has(category)
        ? Math.max(Math.ceil((current * 0.8) / 100) * 100, 100) // guaranteed near/over
        : Math.ceil((monthlyAvg * 1.2) / 100) * 100;            // comfortable
      return { userId: USER_ID, category, amount, period: "MONTHLY" };
    });

    await db.categoryBudget.deleteMany({ where: { userId: USER_ID } });
    if (budgetRows.length > 0) {
      await db.categoryBudget.createMany({ data: budgetRows });
    }

    // ── 3. Anomalies + forecasts (computed from the seeded data) ──
    await db.anomaly.deleteMany({ where: { userId: USER_ID } });
    await detectAndPersistAnomalies(USER_ID);
    await generateAndPersistForecasts(USER_ID);

    // ── 4. A completed sample simulation for the Digital Twin ──
    await db.simulation.deleteMany({ where: { userId: USER_ID } });
    const inputs = await loadSimulationInputs(USER_ID);
    const shocks = [{ type: "JOB_LOSS", startMonth: 2, durationMonths: 3 }];
    const horizon = 12;
    const iterations = 1000;
    const BATCHES = 10;
    const batchResults = Array.from({ length: BATCHES }, (_, i) =>
      simulateBatch(
        { ...inputs, shocks },
        { seed: hashStringToSeed(`seed-sim:${i}`), iterations: iterations / BATCHES, horizon }
      )
    );
    const results = aggregateBatches(batchResults, horizon);
    await db.simulation.create({
      data: {
        userId: USER_ID,
        name: "Sample: 3-month job loss",
        scenario: { shocks },
        status: "COMPLETED",
        iterations,
        horizonMonths: horizon,
        results,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Seeded ${transactions.length} transactions, ${budgetRows.length} budgets, anomalies, forecasts and a sample simulation.`,
    };
  } catch (error) {
    console.error("Error seeding data:", error);
    return { success: false, error: error.message };
  }
}
