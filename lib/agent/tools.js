// Welth Agent tool registry. Each tool exposes a Gemini function declaration +
// a handler. Handlers ALWAYS receive userId from the trusted session context
// (ctx.userId) — never from the model — and re-scope every query to that user.
//
// mutating: true  → the loop proposes the action for human confirmation instead
//                   of executing it. The same handler runs on confirm.

import { SchemaType } from "@google/generative-ai";
import { db } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { defaultCategories } from "@/data/categories";
import { generateAndPersistForecasts } from "@/lib/forecast";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const EXPENSE_IDS = defaultCategories.filter((c) => c.type === "EXPENSE").map((c) => c.id);

function periodRange(period, now = new Date()) {
  switch (period) {
    case "last_month":
      return { gte: startOfMonth(subMonths(now, 1)), lte: endOfMonth(subMonths(now, 1)) };
    case "last_3_months":
      return { gte: startOfMonth(subMonths(now, 3)), lte: endOfMonth(now) };
    case "this_month":
    default:
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
  }
}

// ─────────────────────────── READ TOOLS ───────────────────────────

async function getSpendingSummary({ period = "this_month" }, { userId }) {
  const range = periodRange(period);
  const txns = await db.transaction.findMany({
    where: { userId, date: range },
    select: { type: true, amount: true, category: true },
  });
  let totalIncome = 0, totalExpense = 0;
  const byCat = {};
  for (const t of txns) {
    const a = t.amount.toNumber();
    if (t.type === "INCOME") totalIncome += a;
    else { totalExpense += a; byCat[t.category] = (byCat[t.category] || 0) + a; }
  }
  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }));
  return {
    period,
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    net: Math.round(totalIncome - totalExpense),
    topCategories,
  };
}

async function getBudgetStatus(_args, { userId }) {
  const now = new Date();
  const [budgets, grouped] = await Promise.all([
    db.categoryBudget.findMany({ where: { userId } }),
    db.transaction.groupBy({
      by: ["category"],
      where: { userId, type: "EXPENSE", date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { amount: true },
    }),
  ]);
  const spent = Object.fromEntries(grouped.map((g) => [g.category, g._sum.amount?.toNumber() || 0]));
  if (budgets.length === 0) return { budgets: [], note: "No category budgets set yet." };
  return {
    budgets: budgets.map((b) => {
      const amt = b.amount.toNumber();
      const used = spent[b.category] || 0;
      return {
        category: b.category,
        budget: Math.round(amt),
        spent: Math.round(used),
        pctUsed: amt > 0 ? Math.round((used / amt) * 100) : 0,
        status: used > amt ? "over" : used / amt >= 0.8 ? "warning" : "ok",
      };
    }),
  };
}

async function listAnomalies({ severity }, { userId }) {
  const anomalies = await db.anomaly.findMany({
    where: { userId, ...(severity ? { severity } : {}) },
    orderBy: { detectedAt: "desc" },
    take: 10,
    select: { type: true, severity: true, category: true, message: true, detectedAt: true },
  });
  return { count: anomalies.length, anomalies };
}

async function predictExpenses({ category }, { userId }) {
  const nextMonth = startOfMonth(subMonths(new Date(), -1));
  let forecasts = await db.expenseForecast.findMany({ where: { userId, month: nextMonth } });
  if (forecasts.length === 0) {
    await generateAndPersistForecasts(userId);
    forecasts = await db.expenseForecast.findMany({ where: { userId, month: nextMonth } });
  }
  if (category) {
    const f = forecasts.find((x) => x.category === category);
    return f
      ? { category, predicted: Math.round(f.predicted.toNumber()), method: f.method }
      : { category, note: "Not enough history to forecast this category." };
  }
  const overall = forecasts.find((f) => f.category === null);
  const byCategory = forecasts
    .filter((f) => f.category !== null)
    .map((f) => ({ category: f.category, predicted: Math.round(f.predicted.toNumber()) }))
    .sort((a, b) => b.predicted - a.predicted)
    .slice(0, 6);
  return {
    overall: overall ? Math.round(overall.predicted.toNumber()) : null,
    byCategory,
  };
}

async function getTransactions({ category, type, limit = 10 }, { userId }) {
  const txns = await db.transaction.findMany({
    where: { userId, ...(category ? { category } : {}), ...(type ? { type } : {}) },
    orderBy: { date: "desc" },
    take: Math.min(limit, 25),
    select: { amount: true, type: true, category: true, description: true, date: true },
  });
  return {
    transactions: txns.map((t) => ({
      amount: t.amount.toNumber(),
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date.toISOString().slice(0, 10),
    })),
  };
}

async function runFinancialSimulation(
  { horizonMonths = 12, jobLossDurationMonths = 0, incomeChangePct = 0, bigPurchaseAmount = 0 },
  { userId }
) {
  const shocks = [];
  if (jobLossDurationMonths > 0)
    shocks.push({ type: "JOB_LOSS", startMonth: 1, durationMonths: jobLossDurationMonths });
  if (incomeChangePct !== 0)
    shocks.push({ type: "INCOME_CHANGE", startMonth: 1, pct: incomeChangePct });
  if (bigPurchaseAmount > 0)
    shocks.push({ type: "BIG_PURCHASE", month: 1, amount: bigPurchaseAmount });

  const sim = await db.simulation.create({
    data: {
      userId,
      name: "Agent scenario",
      horizonMonths: Math.min(Math.max(horizonMonths, 1), 60),
      iterations: 1000,
      scenario: { shocks },
      status: "PENDING",
    },
  });
  await inngest.send({ name: "simulation.requested", data: { simulationId: sim.id } });
  return {
    simulationId: sim.id,
    status: "started",
    note: "Simulation is running. Results will appear on the Digital Twin (/simulations) page shortly.",
  };
}

// ─────────────────────────── MUTATING TOOLS ───────────────────────────

async function setCategoryBudget({ category, amount }, { userId }) {
  if (!EXPENSE_IDS.includes(category)) throw new Error(`Unknown expense category "${category}"`);
  if (!(amount > 0)) throw new Error("Amount must be positive");
  const budget = await db.categoryBudget.upsert({
    where: { userId_category: { userId, category } },
    update: { amount },
    create: { userId, category, amount },
  });
  return { category, amount: budget.amount.toNumber(), ok: true };
}

async function createExpense({ amount, category, description }, { userId }) {
  if (!EXPENSE_IDS.includes(category)) throw new Error(`Unknown expense category "${category}"`);
  if (!(amount > 0)) throw new Error("Amount must be positive");

  const account = await db.account.findFirst({
    where: { userId, isDefault: true },
  });
  if (!account) throw new Error("No default account found");

  const txn = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount,
        category,
        description: description || `${category} expense`,
        date: new Date(),
        userId,
        accountId: account.id,
      },
    });
    await tx.account.update({
      where: { id: account.id },
      data: { balance: { increment: -amount } },
    });
    return created;
  });

  return { id: txn.id, amount, category, account: account.name, ok: true };
}

// ─────────────────────────── REGISTRY ───────────────────────────

export const TOOLS = {
  getSpendingSummary: {
    mutating: false,
    handler: getSpendingSummary,
    declaration: {
      name: "getSpendingSummary",
      description: "Get total income, expenses, net, and top spending categories for a period.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          period: {
            type: SchemaType.STRING,
            description: "One of: this_month, last_month, last_3_months. Defaults to this_month.",
          },
        },
      },
    },
  },
  getBudgetStatus: {
    mutating: false,
    handler: getBudgetStatus,
    declaration: {
      name: "getBudgetStatus",
      description: "Get the user's per-category budgets and how much of each is spent this month.",
      parameters: { type: SchemaType.OBJECT, properties: {} },
    },
  },
  listAnomalies: {
    mutating: false,
    handler: listAnomalies,
    declaration: {
      name: "listAnomalies",
      description: "List recently detected spending anomalies (unusual transactions, surges, overruns).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          severity: { type: SchemaType.STRING, description: "Optional filter: LOW, MEDIUM, or HIGH." },
        },
      },
    },
  },
  predictExpenses: {
    mutating: false,
    handler: predictExpenses,
    declaration: {
      name: "predictExpenses",
      description: "Forecast next month's expenses, overall or for a specific category.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING, description: "Optional category id, e.g. 'food'." },
        },
      },
    },
  },
  getTransactions: {
    mutating: false,
    handler: getTransactions,
    declaration: {
      name: "getTransactions",
      description: "List recent transactions, optionally filtered by category or type (INCOME/EXPENSE).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING, description: "INCOME or EXPENSE" },
          limit: { type: SchemaType.NUMBER, description: "Max rows (<=25)." },
        },
      },
    },
  },
  runFinancialSimulation: {
    mutating: false, // only starts an analysis; touches no money
    handler: runFinancialSimulation,
    declaration: {
      name: "runFinancialSimulation",
      description:
        "Start a Monte Carlo simulation of the user's finances under a scenario (e.g. job loss, income change, big purchase). Returns a simulation id; results appear on the Digital Twin page.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          horizonMonths: { type: SchemaType.NUMBER, description: "Months to project (default 12)." },
          jobLossDurationMonths: { type: SchemaType.NUMBER, description: "Months of zero income, if any." },
          incomeChangePct: { type: SchemaType.NUMBER, description: "Percent income change, e.g. -20." },
          bigPurchaseAmount: { type: SchemaType.NUMBER, description: "One-time purchase amount in INR." },
        },
      },
    },
  },
  setCategoryBudget: {
    mutating: true,
    handler: setCategoryBudget,
    declaration: {
      name: "setCategoryBudget",
      description: "Set or update the user's monthly budget for a spending category.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING, description: "Expense category id, e.g. 'food'." },
          amount: { type: SchemaType.NUMBER, description: "Monthly budget amount in INR." },
        },
        required: ["category", "amount"],
      },
    },
  },
  createExpense: {
    mutating: true,
    handler: createExpense,
    declaration: {
      name: "createExpense",
      description: "Record a new expense transaction on the user's default account.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          amount: { type: SchemaType.NUMBER, description: "Expense amount in INR." },
          category: { type: SchemaType.STRING, description: "Expense category id, e.g. 'food'." },
          description: { type: SchemaType.STRING, description: "Optional description." },
        },
        required: ["amount", "category"],
      },
    },
  },
};

export const FUNCTION_DECLARATIONS = Object.values(TOOLS).map((t) => t.declaration);

export const SYSTEM_PROMPT = `You are Welth Agent, a helpful personal-finance assistant embedded in the user's Welth dashboard.
- Use the provided tools to fetch real data before answering questions about the user's finances. Never invent numbers.
- All amounts are in Indian Rupees (₹).
- Valid expense category ids: ${EXPENSE_IDS.join(", ")}.
- When the user asks to change something (set a budget, add an expense), call the appropriate tool; the app will ask the user to confirm before it takes effect.
- Be concise and friendly. Summarize numbers clearly. If a tool returns no data, say so honestly.`;

/** Build a short grounding summary injected as system context each turn. */
export async function buildFinancialContext(userId) {
  const now = new Date();
  const [agg, budgetCount, unread] = await Promise.all([
    db.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { amount: true },
    }),
    db.categoryBudget.count({ where: { userId } }),
    db.anomaly.count({ where: { userId, isRead: false } }),
  ]);
  const income = agg.find((a) => a.type === "INCOME")?._sum.amount?.toNumber() || 0;
  const expense = agg.find((a) => a.type === "EXPENSE")?._sum.amount?.toNumber() || 0;
  return `Current month so far — income: ₹${Math.round(income)}, expenses: ₹${Math.round(
    expense
  )}. Category budgets set: ${budgetCount}. Unread anomalies: ${unread}.`;
}
