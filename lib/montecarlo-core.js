// Pure Monte Carlo engine for the Financial Digital Twin. No DB / no framework
// imports so it can be unit-tested and run inside distributed batch workers.
// Uses a seeded PRNG so each simulation is fully reproducible.

import { percentile, mean, seededRng } from "./stats.js";

const round = (x) => Math.round(x * 100) / 100;

// Draw one monthly sample from an empirical series (bootstrap). With a single
// data point we add mild ±15% jitter so the simulation isn't perfectly flat.
function drawSample(series, rng) {
  if (!series || series.length === 0) return 0;
  if (series.length === 1) return series[0] * (0.85 + 0.3 * rng());
  return series[Math.floor(rng() * series.length)];
}

/**
 * Simulate a single trajectory over `horizon` months.
 * inputs: { startingBalance, monthlyIncome[], monthlyExpense[], shocks[] }
 */
export function simulateIteration(inputs, horizon, rng) {
  const { startingBalance, monthlyIncome, monthlyExpense, shocks = [] } = inputs;
  let balance = startingBalance;
  let minBalance = balance;
  const trajectory = new Array(horizon);

  for (let h = 1; h <= horizon; h++) {
    let income = drawSample(monthlyIncome, rng);
    let expense = drawSample(monthlyExpense, rng);

    for (const s of shocks) {
      switch (s.type) {
        case "JOB_LOSS":
          if (h >= (s.startMonth || 1) && h < (s.startMonth || 1) + (s.durationMonths || 0)) {
            income = 0;
          }
          break;
        case "INCOME_CHANGE":
          if (h >= (s.startMonth || 1)) income *= 1 + (s.pct || 0) / 100;
          break;
        case "EXPENSE_INFLATION":
          expense *= 1 + (s.pct || 0) / 100;
          break;
        case "NEW_LOAN":
          if (h >= (s.startMonth || 1) && h < (s.startMonth || 1) + (s.months || 0)) {
            expense += s.emi || 0;
          }
          break;
        case "BIG_PURCHASE":
          if (h === (s.month || 1)) expense += s.amount || 0;
          break;
        default:
          break;
      }
    }

    income = Math.max(0, income);
    expense = Math.max(0, expense);
    balance = balance + income - expense;
    trajectory[h - 1] = balance;
    if (balance < minBalance) minBalance = balance;
  }

  return { trajectory, minBalance, endBalance: balance };
}

/**
 * Run one batch of `iterations` trajectories. Returns per-month balance arrays
 * plus an insolvency count. Deterministic for a given seed.
 */
export function simulateBatch(inputs, { seed, iterations, horizon }) {
  const rng = seededRng(seed);
  const balancesByMonth = Array.from({ length: horizon }, () => []);
  let insolventCount = 0;

  for (let i = 0; i < iterations; i++) {
    const { trajectory, minBalance } = simulateIteration(inputs, horizon, rng);
    for (let h = 0; h < horizon; h++) balancesByMonth[h].push(trajectory[h]);
    if (minBalance < 0) insolventCount++;
  }

  return { balancesByMonth, insolventCount, iterations };
}

/**
 * Merge batch results into final percentile bands + summary metrics.
 * Percentiles are computed from the pooled per-month values (they cannot be
 * merged from per-batch percentiles), which is why batches return raw arrays.
 */
export function aggregateBatches(batchResults, horizon) {
  const perMonth = Array.from({ length: horizon }, () => []);
  let insolventCount = 0;
  let totalIter = 0;

  for (const b of batchResults) {
    for (let h = 0; h < horizon; h++) perMonth[h].push(...b.balancesByMonth[h]);
    insolventCount += b.insolventCount;
    totalIter += b.iterations;
  }

  const trajectories = perMonth.map((vals, h) => ({
    month: h + 1,
    p5: round(percentile(vals, 5)),
    p10: round(percentile(vals, 10)),
    p25: round(percentile(vals, 25)),
    p50: round(percentile(vals, 50)),
    p75: round(percentile(vals, 75)),
    p90: round(percentile(vals, 90)),
    p95: round(percentile(vals, 95)),
    mean: round(mean(vals)),
  }));

  const endVals = perMonth[horizon - 1] || [];

  return {
    horizonMonths: horizon,
    iterations: totalIter,
    probInsolvency: totalIter ? insolventCount / totalIter : 0,
    medianEndBalance: round(percentile(endVals, 50)),
    p10EndBalance: round(percentile(endVals, 10)),
    worstCaseEndBalance: round(percentile(endVals, 5)),
    trajectories,
  };
}
