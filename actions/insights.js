"use server";

import { db } from "@/lib/prisma";
import { detectAndPersistAnomalies } from "@/lib/anomaly";
import { generateAndPersistForecasts } from "@/lib/forecast";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";

async function getAuthedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");
  return user;
}

const serializeAnomaly = (a) => ({
  ...a,
  score: a.score ? a.score.toNumber() : 0,
});

export async function getAnomalies({ unreadOnly = false } = {}) {
  const user = await getAuthedUser();
  const anomalies = await db.anomaly.findMany({
    where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });
  return anomalies.map(serializeAnomaly);
}

export async function markAnomalyRead(id) {
  try {
    const user = await getAuthedUser();
    await db.anomaly.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
    revalidatePath("/insights");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function markAllAnomaliesRead() {
  try {
    const user = await getAuthedUser();
    await db.anomaly.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/insights");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/** On-demand anomaly scan (also runs on a schedule via Inngest). */
export async function runAnomalyScan() {
  try {
    const user = await getAuthedUser();
    const result = await detectAndPersistAnomalies(user.id);
    revalidatePath("/insights");
    return { success: true, created: result.created };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/** On-demand forecast regeneration (also runs monthly via Inngest). */
export async function runForecast() {
  try {
    const user = await getAuthedUser();
    const result = await generateAndPersistForecasts(user.id);
    revalidatePath("/insights");
    return { success: true, created: result.created };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Data for the forecast chart: last 6 months of actual overall spend + the
 * stored next-month forecast (overall) and per-category predictions.
 */
export async function getForecasts() {
  const user = await getAuthedUser();
  const now = new Date();
  const nextMonth = startOfMonth(addMonths(now, 1));

  const [stored, txns] = await Promise.all([
    db.expenseForecast.findMany({ where: { userId: user.id, month: nextMonth } }),
    db.transaction.findMany({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: { gte: startOfMonth(subMonths(now, 6)), lte: endOfMonth(subMonths(now, 1)) },
      },
      select: { amount: true, date: true },
    }),
  ]);

  const monthly = {};
  for (const t of txns) {
    const k = `${t.date.getFullYear()}-${t.date.getMonth()}`;
    monthly[k] = (monthly[k] || 0) + t.amount.toNumber();
  }

  const history = [];
  for (let i = 6; i >= 1; i--) {
    const d = startOfMonth(subMonths(now, i));
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    history.push({
      month: d.toLocaleString("default", { month: "short" }),
      actual: Number((monthly[k] || 0).toFixed(2)),
    });
  }

  const overall = stored.find((f) => f.category === null);
  const byCategory = stored
    .filter((f) => f.category !== null)
    .map((f) => ({
      category: f.category,
      predicted: f.predicted.toNumber(),
      lower: f.lowerBound.toNumber(),
      upper: f.upperBound.toNumber(),
    }))
    .sort((a, b) => b.predicted - a.predicted);

  return {
    history,
    nextMonthLabel: nextMonth.toLocaleString("default", { month: "long" }),
    overall: overall
      ? {
          predicted: overall.predicted.toNumber(),
          lower: overall.lowerBound.toNumber(),
          upper: overall.upperBound.toNumber(),
          method: overall.method,
        }
      : null,
    byCategory,
  };
}
