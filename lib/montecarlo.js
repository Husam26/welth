// DB-backed inputs for the Monte Carlo engine: fits monthly income/expense
// distributions and the starting balance from the user's recent history.

import { db } from "@/lib/prisma";
import { startOfMonth, subMonths, endOfMonth } from "date-fns";

const HISTORY_MONTHS = 6;

export async function loadSimulationInputs(userId, { now = new Date() } = {}) {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { balance: true },
  });
  const startingBalance = accounts.reduce((s, a) => s + a.balance.toNumber(), 0);

  const start = startOfMonth(subMonths(now, HISTORY_MONTHS));
  const end = endOfMonth(subMonths(now, 1)); // complete months only

  const txns = await db.transaction.findMany({
    where: { userId, date: { gte: start, lte: end } },
    select: { type: true, amount: true, date: true },
  });

  const inc = {};
  const exp = {};
  for (const t of txns) {
    const k = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    const a = t.amount.toNumber();
    if (t.type === "INCOME") inc[k] = (inc[k] || 0) + a;
    else exp[k] = (exp[k] || 0) + a;
  }

  return {
    startingBalance,
    monthlyIncome: Object.values(inc),
    monthlyExpense: Object.values(exp),
  };
}
