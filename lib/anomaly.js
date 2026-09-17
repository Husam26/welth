// Anomaly detection for spending. Pure detection logic (testable) + a
// persistence wrapper. Uses robust statistics from lib/stats.js so a few
// large outliers don't mask the next one.

import { db } from "@/lib/prisma";
import { median, mad, modifiedZScore, mean, stdDev } from "@/lib/stats";
import { formatCurrency } from "@/lib/currency";
import {
  subDays,
  startOfWeek,
  differenceInHours,
  getDaysInMonth,
} from "date-fns";

const LOOKBACK_DAYS = 90;      // history window for baselines
const RECENT_DAYS = 30;        // only flag transactions this recent
const SPIKE_Z_THRESHOLD = 3.5; // modified z-score cutoff
const SURGE_SIGMA = 2;         // weekly-surge cutoff (mean + kσ)
const MIN_BASELINE = 8;        // min samples before we trust a category baseline
const DUP_WINDOW_HOURS = 48;

const normalizeDesc = (d) => (d || "").trim().toLowerCase();
const weekKey = (date) =>
  startOfWeek(date, { weekStartsOn: 1 }).toISOString().slice(0, 10);
const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

/**
 * Pure detector. Input transactions must have amount as a plain number and
 * date as a Date. Returns an array of candidate anomaly objects (not persisted).
 */
export function detectAnomalies({ transactions, categoryBudgets = [], now = new Date() }) {
  const anomalies = [];
  const expenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .sort((a, b) => a.date - b.date);

  const recentCutoff = subDays(now, RECENT_DAYS);

  // Group expenses by category
  const byCategory = {};
  for (const t of expenses) (byCategory[t.category] ??= []).push(t);

  // ── 1. AMOUNT_SPIKE — single transaction far above its category norm ──
  for (const [category, txns] of Object.entries(byCategory)) {
    if (txns.length < MIN_BASELINE) continue;
    const amounts = txns.map((t) => t.amount);
    const med = median(amounts);
    const madVal = mad(amounts);
    if (!madVal) continue;

    for (const t of txns) {
      if (t.date < recentCutoff) continue;
      const z = modifiedZScore(t.amount, med, madVal);
      if (z > SPIKE_Z_THRESHOLD) {
        const ratio = med > 0 ? t.amount / med : 0;
        anomalies.push({
          type: "AMOUNT_SPIKE",
          category,
          transactionId: t.id,
          score: z,
          severity: z > 6 ? "HIGH" : "MEDIUM",
          message: `Unusually large ${category} expense of ${formatCurrency(
            t.amount
          )}${ratio ? ` — about ${ratio.toFixed(1)}× your typical ${category} spend` : ""}.`,
          dedupeKey: `AMOUNT_SPIKE:${t.id}`,
          metadata: { median: med, mad: madVal, observed: t.amount, z },
        });
      }
    }
  }

  // ── 2. NEW_MERCHANT — first-seen description with an above-median amount ──
  const seenBefore = new Set(
    expenses
      .filter((t) => t.date < recentCutoff)
      .map((t) => normalizeDesc(t.description))
  );
  for (const [category, txns] of Object.entries(byCategory)) {
    const amounts = txns.map((t) => t.amount);
    const med = median(amounts);
    for (const t of txns) {
      if (t.date < recentCutoff) continue;
      const desc = normalizeDesc(t.description);
      if (!desc) continue;
      if (!seenBefore.has(desc) && med > 0 && t.amount > med) {
        anomalies.push({
          type: "NEW_MERCHANT",
          category,
          transactionId: t.id,
          score: med > 0 ? t.amount / med : 0,
          severity: "LOW",
          message: `First-time ${category} expense "${t.description}" of ${formatCurrency(
            t.amount
          )}.`,
          dedupeKey: `NEW_MERCHANT:${t.id}`,
          metadata: { observed: t.amount, categoryMedian: med },
        });
      }
    }
  }

  // ── 3. DUPLICATE_CHARGE — same amount + description within 48h ──
  const dupGroups = {};
  for (const t of expenses) {
    const key = `${t.amount.toFixed(2)}|${normalizeDesc(t.description)}`;
    (dupGroups[key] ??= []).push(t);
  }
  for (const group of Object.values(dupGroups)) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      if (curr.date < recentCutoff) continue;
      if (Math.abs(differenceInHours(curr.date, prev.date)) <= DUP_WINDOW_HOURS) {
        anomalies.push({
          type: "DUPLICATE_CHARGE",
          category: curr.category,
          transactionId: curr.id,
          score: 0,
          severity: "MEDIUM",
          message: `Possible duplicate charge: ${formatCurrency(
            curr.amount
          )} for "${curr.description}" within ${DUP_WINDOW_HOURS}h.`,
          dedupeKey: `DUPLICATE_CHARGE:${curr.id}`,
          metadata: { amount: curr.amount, previousId: prev.id },
        });
      }
    }
  }

  // ── 4. CATEGORY_SURGE — this week's category total vs trailing weeks ──
  const thisWeek = weekKey(now);
  for (const [category, txns] of Object.entries(byCategory)) {
    const weekly = {};
    for (const t of txns) {
      const wk = weekKey(t.date);
      weekly[wk] = (weekly[wk] || 0) + t.amount;
    }
    const current = weekly[thisWeek] || 0;
    const trailing = Object.entries(weekly)
      .filter(([wk]) => wk !== thisWeek)
      .map(([, total]) => total);
    if (trailing.length < 4 || current <= 0) continue;

    const m = mean(trailing);
    const sd = stdDev(trailing);
    const threshold = m + SURGE_SIGMA * sd;
    if (current > threshold && current > m) {
      const ratio = m > 0 ? current / m : 0;
      anomalies.push({
        type: "CATEGORY_SURGE",
        category,
        transactionId: null,
        score: sd > 0 ? (current - m) / sd : 0,
        severity: ratio >= 3 ? "HIGH" : "MEDIUM",
        message: `You spent ${formatCurrency(current)} on ${category} this week${
          ratio ? ` — about ${ratio.toFixed(1)}× your usual weekly ${category} spend` : ""
        }.`,
        dedupeKey: `CATEGORY_SURGE:${category}:${thisWeek}`,
        metadata: { current, weeklyMean: m, weeklyStdDev: sd, threshold },
      });
    }
  }

  // ── 5. BUDGET_OVERRUN — pace to exceed (or already exceeded) a budget ──
  const mKey = monthKey(now);
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = now.getDate();
  for (const budget of categoryBudgets) {
    const spent = expenses
      .filter(
        (t) => t.category === budget.category && monthKey(t.date) === mKey
      )
      .reduce((sum, t) => sum + t.amount, 0);
    if (spent <= 0 || budget.amount <= 0) continue;

    const projected = (spent / dayOfMonth) * daysInMonth;
    const alreadyOver = spent > budget.amount;
    const pacingOver = projected > budget.amount;
    if (alreadyOver || pacingOver) {
      anomalies.push({
        type: "BUDGET_OVERRUN",
        category: budget.category,
        transactionId: null,
        score: budget.amount > 0 ? spent / budget.amount : 0,
        severity: alreadyOver ? "HIGH" : "MEDIUM",
        message: alreadyOver
          ? `You've exceeded your ${budget.category} budget: ${formatCurrency(
              spent
            )} of ${formatCurrency(budget.amount)}.`
          : `You're on pace to exceed your ${budget.category} budget (projected ${formatCurrency(
              projected
            )} vs ${formatCurrency(budget.amount)}).`,
        dedupeKey: `BUDGET_OVERRUN:${budget.category}:${mKey}`,
        metadata: { spent, budget: budget.amount, projected },
      });
    }
  }

  return anomalies;
}

/**
 * Fetch a user's recent history, run detection, dedupe against existing
 * anomalies, and persist the fresh ones. Used by both the Inngest job and the
 * on-demand "Scan now" action.
 */
export async function detectAndPersistAnomalies(userId, { now = new Date() } = {}) {
  const since = subDays(now, LOOKBACK_DAYS);

  const [txRows, categoryBudgets, existing] = await Promise.all([
    db.transaction.findMany({
      where: { userId, date: { gte: since } },
      select: { id: true, type: true, amount: true, category: true, description: true, date: true },
    }),
    db.categoryBudget.findMany({ where: { userId } }),
    db.anomaly.findMany({
      where: { userId, detectedAt: { gte: subDays(now, 40) } },
      select: { metadata: true },
    }),
  ]);

  const transactions = txRows.map((t) => ({ ...t, amount: t.amount.toNumber() }));
  const budgets = categoryBudgets.map((b) => ({
    category: b.category,
    amount: b.amount.toNumber(),
  }));

  const candidates = detectAnomalies({ transactions, categoryBudgets: budgets, now });

  const existingKeys = new Set(
    existing.map((a) => a.metadata?.dedupeKey).filter(Boolean)
  );
  const fresh = candidates.filter((c) => !existingKeys.has(c.dedupeKey));
  if (fresh.length === 0) return { created: 0 };

  await db.anomaly.createMany({
    data: fresh.map((c) => ({
      userId,
      transactionId: c.transactionId || null,
      category: c.category || null,
      type: c.type,
      severity: c.severity,
      score: c.score ?? 0,
      message: c.message,
      metadata: { dedupeKey: c.dedupeKey, ...c.metadata },
    })),
  });

  return { created: fresh.length, anomalies: fresh };
}
