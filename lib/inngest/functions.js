import { sendEmail } from "@/actions/send-email";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";
import { genAI, GEMINI_MODEL } from "@/lib/gemini";
import { detectAndPersistAnomalies } from "@/lib/anomaly";
import { generateAndPersistForecasts } from "@/lib/forecast";
import { loadSimulationInputs } from "@/lib/montecarlo";
import { simulateBatch, aggregateBatches } from "@/lib/montecarlo-core";
import { hashStringToSeed } from "@/lib/stats";


export const checkBudgetAlert = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    // Fetch budgets
    const budgets = await step.run("fetch-budget", async () => {
      try {
        return await db.budget.findMany({
          include: {
            user: {
              include: {
                accounts: {
                  where: { isDefault: true },
                },
              },
            },
          },
        });
      } catch (error) {
        throw error;
      }
    });

    // Global (overall) budget alerts — skipped if the user has none, but we
    // still fall through to the per-category budget checks below.
    for (const budget of budgets || []) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue; // Skip if no default account

      await step.run(`check-budget-${budget.id}`, async () => {
        try {
          const startDate = new Date();
          startDate.setDate(1); // Start of current month

          const expenses = await db.transaction.aggregate({
            where: {
              userId: budget.userId,
              accountId: defaultAccount.id,
              type: "EXPENSE",
              date: { gte: startDate },
            },
            _sum: { amount: true },
          });

          const totalExpenses = expenses._sum.amount?.toNumber() || 0;
          const budgetAmount = budget.amount;
          const percentageUsed = (totalExpenses / budgetAmount) * 100;

          if (
            percentageUsed >= 80 &&
            (!budget.lastAlertSent ||
              isNewMonth(budget.lastAlertSent, new Date()))
          ) {
            //Sending emails

            await sendEmail({
              to: budget.user.email,
              subject: `Budget Alert for ${defaultAccount.name}`,
              react: EmailTemplate({
                userName: budget.user.name,
                type : "budget-alert",
                data: {
                  percentageUsed,
                  budgetAmount: parseInt(budgetAmount).toFixed(1),
                  totalExpenses: parseInt(totalExpenses).toFixed(1),
                  accountName: defaultAccount.name,
                },
              }),
            });
            

            // Update lastAlertSent date
            try {
              await db.budget.update({
                where: { id: budget.id },
                data: { lastAlertSent: new Date() },
              });
            } catch (error) {
              throw new Error("Budget update failed");
            }
          }
        } catch (error) {
          throw error;
        }
      });
    }

    // Per-category budget alerts (Phase 2, Step 1)
    const categoryBudgets = await step.run("fetch-category-budgets", async () => {
      return await db.categoryBudget.findMany({
        include: { user: true },
      });
    });

    for (const catBudget of categoryBudgets || []) {
      await step.run(`check-category-budget-${catBudget.id}`, async () => {
        const startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0); // Start of current month

        const expenses = await db.transaction.aggregate({
          where: {
            userId: catBudget.userId,
            type: "EXPENSE",
            category: catBudget.category,
            date: { gte: startDate },
          },
          _sum: { amount: true },
        });

        const totalExpenses = expenses._sum.amount?.toNumber() || 0;
        const budgetAmount = catBudget.amount.toNumber();
        if (budgetAmount <= 0) return;

        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 &&
          (!catBudget.lastAlertSent ||
            isNewMonth(catBudget.lastAlertSent, new Date()))
        ) {
          await sendEmail({
            to: catBudget.user.email,
            subject: `Category Budget Alert: ${catBudget.category}`,
            react: EmailTemplate({
              userName: catBudget.user.name,
              type: "category-budget-alert",
              data: {
                category: catBudget.category,
                percentageUsed,
                budgetAmount: budgetAmount.toFixed(1),
                totalExpenses: totalExpenses.toFixed(1),
              },
            }),
          });

          await db.categoryBudget.update({
            where: { id: catBudget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

// Ensure `lastAlertSent` is a valid date before calling `.getMonth()`
function isNewMonth(lastAlertDate, currentDate) {
  if (!lastAlertDate) return true;
  const lastDate = new Date(lastAlertDate);
  return (
    lastDate.getMonth() !== currentDate.getMonth() ||
    lastDate.getFullYear() !== currentDate.getFullYear()
  );
}


// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },//never processed
              {
                nextRecurringDate: {
                  lte: new Date(),//due date passed
                },
              },
            ],
          },
        });
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);



// 1. Recurring Transaction Processing with Throttling
export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      // Create new transaction and update account balance in a transaction
      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);
// Utility functions
function isTransactionDue(transaction) {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}


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

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" }, // First day of each month
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({
        include: { accounts: true },
      });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);


async function generateFinancialInsights(stats, month) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: ₹${stats.totalIncome}
    - Total Expenses: ₹${stats.totalExpenses}
    - Net Income: ₹${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: ₹${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}



async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {},
      transactionCount: transactions.length,
    }
  );
}

// ── Phase 2, Step 2: Anomaly detection & forecasting ──

// Near-real-time: runs whenever a transaction is created (fired from
// createTransaction). Scoped to a single user, so it's cheap.
export const detectAnomaliesForUser = inngest.createFunction(
  { id: "detect-anomalies-for-user" },
  { event: "transaction.created" },
  async ({ event, step }) => {
    if (!event?.data?.userId) return { error: "Missing userId" };
    return await step.run("detect", async () => {
      return await detectAndPersistAnomalies(event.data.userId);
    });
  }
);

// Scheduled sweep for every user (catches surges/budget pacing that build up
// over time even without a new transaction).
export const detectAnomaliesDaily = inngest.createFunction(
  { id: "detect-anomalies-daily" },
  { cron: "0 2 * * *" }, // daily at 02:00
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({ select: { id: true } });
    });

    let total = 0;
    for (const user of users) {
      const res = await step.run(`detect-${user.id}`, async () => {
        return await detectAndPersistAnomalies(user.id);
      });
      total += res?.created || 0;
    }
    return { usersScanned: users.length, anomaliesCreated: total };
  }
);

// Monthly forecast regeneration for every user.
export const generateForecasts = inngest.createFunction(
  { id: "generate-forecasts" },
  { cron: "0 1 1 * *" }, // 1st of each month at 01:00
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return await db.user.findMany({ select: { id: true } });
    });

    for (const user of users) {
      await step.run(`forecast-${user.id}`, async () => {
        return await generateAndPersistForecasts(user.id);
      });
    }
    return { processed: users.length };
  }
);

// ── Phase 2, Step 3: Financial Digital Twin (Monte Carlo, fan-out) ──
const SIM_BATCHES = 10; // trajectories are split across this many parallel workers

export const runSimulation = inngest.createFunction(
  { id: "run-simulation" },
  { event: "simulation.requested" },
  async ({ event, step }) => {
    const simulationId = event.data?.simulationId;
    if (!simulationId) return { error: "Missing simulationId" };

    try {
      // Mark RUNNING and load the fitted inputs
      const prep = await step.run("prepare", async () => {
        const sim = await db.simulation.update({
          where: { id: simulationId },
          data: { status: "RUNNING" },
        });
        const inputs = await loadSimulationInputs(sim.userId);
        return {
          userId: sim.userId,
          horizon: sim.horizonMonths,
          iterations: sim.iterations,
          shocks: sim.scenario?.shocks || [],
          inputs,
        };
      });

      const { horizon, iterations, shocks, inputs } = prep;
      const simInputs = { ...inputs, shocks };
      const perBatch = Math.ceil(iterations / SIM_BATCHES);

      // Fan out: run each batch in parallel (Inngest executes Promise.all steps
      // concurrently). Each batch is seeded deterministically from the sim id.
      const batchResults = await Promise.all(
        Array.from({ length: SIM_BATCHES }, (_, i) =>
          step.run(`batch-${i}`, async () => {
            const res = simulateBatch(simInputs, {
              seed: hashStringToSeed(`${simulationId}:${i}`),
              iterations: perBatch,
              horizon,
            });
            // Persist a compact per-batch summary (bookkeeping / audit)
            await db.simulationBatch.upsert({
              where: { simulationId_batchIndex: { simulationId, batchIndex: i } },
              update: { iterations: perBatch, partial: { insolventCount: res.insolventCount } },
              create: {
                simulationId,
                batchIndex: i,
                iterations: perBatch,
                partial: { insolventCount: res.insolventCount },
              },
            });
            return res;
          })
        )
      );

      // Aggregate percentile bands + summary metrics, then persist
      const results = await step.run("aggregate", async () => {
        const agg = aggregateBatches(batchResults, horizon);
        await db.simulation.update({
          where: { id: simulationId },
          data: { status: "COMPLETED", results: agg, completedAt: new Date() },
        });
        return agg;
      });

      return {
        simulationId,
        probInsolvency: results.probInsolvency,
        medianEndBalance: results.medianEndBalance,
      };
    } catch (error) {
      await step.run("mark-failed", async () => {
        await db.simulation.update({
          where: { id: simulationId },
          data: { status: "FAILED", error: String(error?.message || error).slice(0, 500) },
        });
      });
      return { simulationId, error: String(error?.message || error) };
    }
  }
);

