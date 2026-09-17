// Expense forecasting. Aggregates monthly spend per category and projects next
// month using Holt's linear smoothing (falls back to EWMA on sparse history).

import { db } from "@/lib/prisma";
import { mean, stdDev, holtLinear, ewma } from "@/lib/stats";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";

const HISTORY_MONTHS = 6;

const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

/** Forecast a single monthly series → { predicted, lower, upper, method }. */
function forecastSeries(series) {
  const nonZero = series.filter((v) => v > 0);
  if (nonZero.length < 2) {
    const level = ewma(series, 0.5);
    return {
      predicted: Math.max(0, level),
      lower: Math.max(0, level * 0.7),
      upper: level * 1.3,
      method: "EWMA",
    };
  }
  const { forecast } = holtLinear(series, 0.4, 0.2, 1);
  const spread = stdDev(series);
  const predicted = Math.max(0, forecast);
  return {
    predicted,
    lower: Math.max(0, predicted - spread),
    upper: predicted + spread,
    method: "HOLT",
  };
}

/**
 * Build next-month forecasts (overall + per category) from the last
 * HISTORY_MONTHS complete months and persist them. Overall forecast has
 * category = null.
 */
export async function generateAndPersistForecasts(userId, { now = new Date() } = {}) {
  const start = startOfMonth(subMonths(now, HISTORY_MONTHS));
  const end = endOfMonth(subMonths(now, 1)); // last complete month (exclude current partial)

  const txns = await db.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: start, lte: end } },
    select: { category: true, amount: true, date: true },
  });
  if (txns.length === 0) return { created: 0 };

  // Ordered keys for the HISTORY_MONTHS complete months before the current one
  const monthKeys = [];
  for (let i = HISTORY_MONTHS; i >= 1; i--) {
    monthKeys.push(monthKey(startOfMonth(subMonths(now, i))));
  }

  const seriesByCat = {}; // category -> { monthKey -> total }
  const overall = {};
  for (const t of txns) {
    const k = monthKey(t.date);
    const amt = t.amount.toNumber();
    seriesByCat[t.category] ??= {};
    seriesByCat[t.category][k] = (seriesByCat[t.category][k] || 0) + amt;
    overall[k] = (overall[k] || 0) + amt;
  }

  const buildSeries = (map) => monthKeys.map((k) => map[k] || 0);
  const nextMonth = startOfMonth(addMonths(now, 1));

  const forecasts = [];
  const overallF = forecastSeries(buildSeries(overall));
  forecasts.push({ category: null, ...overallF });

  for (const [category, map] of Object.entries(seriesByCat)) {
    const f = forecastSeries(buildSeries(map));
    if (f.predicted <= 0) continue;
    forecasts.push({ category, ...f });
  }

  // Replace this month's forecasts wholesale (avoids nullable-unique upsert
  // pitfalls with the overall/category=null row).
  await db.$transaction([
    db.expenseForecast.deleteMany({ where: { userId, month: nextMonth } }),
    db.expenseForecast.createMany({
      data: forecasts.map((f) => ({
        userId,
        month: nextMonth,
        category: f.category,
        predicted: f.predicted,
        lowerBound: f.lower,
        upperBound: f.upper,
        method: f.method,
      })),
    }),
  ]);

  return { created: forecasts.length, month: nextMonth };
}
