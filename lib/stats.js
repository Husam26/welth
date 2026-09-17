// Shared, pure statistics utilities used across Phase 2 features
// (per-category budget suggestions, anomaly detection, forecasting, Monte Carlo).
// Everything here is deterministic and unit-testable — no I/O, no randomness
// except the explicitly-seeded PRNG.

/** Arithmetic mean of a numeric array (0 for empty). */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (0 for arrays of length < 2). */
export function stdDev(values) {
  if (!values || values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Median of a numeric array (0 for empty). Does not mutate the input. */
export function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median Absolute Deviation — a robust (outlier-resistant) measure of spread.
 * Scaled by 1.4826 so it estimates the standard deviation for normal data.
 */
export function mad(values) {
  if (!values || values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return 1.4826 * median(deviations);
}

/**
 * Modified z-score based on median/MAD. More robust than the classic
 * (x - mean) / stdDev because a few large outliers don't inflate the spread.
 * Returns 0 when MAD is 0 (no variation) to avoid division by zero.
 */
export function modifiedZScore(x, med, madValue) {
  if (!madValue) return 0;
  return (0.6745 * (x - med)) / madValue;
}

/** Percentile (0-100) of a numeric array using linear interpolation. */
export function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (rank - low) * (sorted[high] - sorted[low]);
}

/**
 * Exponentially Weighted Moving Average forecast. Returns the smoothed level
 * (the one-step-ahead forecast). alpha in (0,1]; higher = more reactive.
 */
export function ewma(series, alpha = 0.4) {
  if (!series || series.length === 0) return 0;
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return level;
}

/**
 * Holt's linear (double exponential) smoothing. Captures level + trend and
 * projects `stepsAhead` periods forward. Returns { level, trend, forecast }.
 */
export function holtLinear(series, alpha = 0.4, beta = 0.2, stepsAhead = 1) {
  if (!series || series.length === 0) return { level: 0, trend: 0, forecast: 0 };
  if (series.length === 1) {
    return { level: series[0], trend: 0, forecast: series[0] };
  }
  let level = series[0];
  let trend = series[1] - series[0];
  for (let i = 1; i < series.length; i++) {
    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend, forecast: level + stepsAhead * trend };
}

/** Draw one random sample from an empirical distribution (bootstrap). */
export function sampleFromEmpirical(series, rng = Math.random) {
  if (!series || series.length === 0) return 0;
  return series[Math.floor(rng() * series.length)];
}

/**
 * Sample from a lognormal distribution given the mu/sigma of the underlying
 * normal. Uses the Box-Muller transform against the supplied PRNG.
 */
export function sampleLogNormal(mu, sigma, rng = Math.random) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

/**
 * mulberry32 — a tiny, fast, seedable PRNG. Given the same numeric seed it
 * produces the same sequence, which makes Monte Carlo runs reproducible.
 * Returns a function that yields floats in [0, 1).
 */
export function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn an arbitrary string (e.g. a uuid) into a 32-bit seed for seededRng. */
export function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
