// Transforms work in z-score space against a benchmark *dispersion*, then
// saturate through tanh. The previous linear `(v - bench) / bench` transform was
// asymmetric for multiplicative ratios, hard-clamped so every bad value looked
// identical, and scored non-meaningful inputs (negative P/E) as excellent.

export const NEUTRAL_SCORE = 50;

/** Excluded from aggregation rather than averaged in. */
export const INVALID_SCORE = Number.NaN;

/** Saturates to +/-1. Uses the sigmoid form to avoid exp() overflow. */
export function tanh(x: number): number {
  if (!Number.isFinite(x)) return Math.sign(x) || 0;
  const z = 2 * x;
  if (z > 40) return 1;
  if (z < -40) return -1;
  const e = Math.exp(z);
  return (e - 1) / (e + 1);
}

// Sigmas at which the transform reaches ~79 / ~93 / ~98.
const SATURATION_SIGMAS = 1.5;

/** Clamp to 0-100, mapping non-finite input to the neutral score. */
export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return NEUTRAL_SCORE;
  return Math.max(0, Math.min(100, value));
}

/** Convert a z-score into a 0-100 score, saturating smoothly. */
export function zToScore(z: number, higherIsBetter: boolean): number {
  if (!Number.isFinite(z)) return NEUTRAL_SCORE;
  const signed = higherIsBetter ? z : -z;
  return clampScore(NEUTRAL_SCORE + 50 * tanh(signed / SATURATION_SIGMAS));
}

/**
 * Score a multiplicative metric (P/E, EV/EBITDA, FCF yield, price vs moving
 * average) against a benchmark ratio, in log space.
 *
 * Log space is what makes the scale symmetric: the old version scored 2x the
 * sector P/E at 0/100 while 0.5x scored 75/100.
 *
 * Returns INVALID_SCORE when either side is non-positive — a zero or negative
 * ratio carries no valuation information.
 */
export function logRatioScore(
  value: number | null,
  benchmark: number | null,
  dispersion: number,
  higherIsBetter: boolean,
): number {
  if (value == null || benchmark == null) return NEUTRAL_SCORE;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(benchmark) ||
    value <= 0 ||
    benchmark <= 0 ||
    dispersion <= 0 ||
    Number.isNaN(dispersion)
  ) {
    return INVALID_SCORE;
  }
  return zToScore(Math.log(value / benchmark) / dispersion, higherIsBetter);
}

/**
 * Score a level or percentage metric (ROE, margins, beta, drawdown) against a
 * benchmark in units of that metric's dispersion. Negative values are valid,
 * which is correct for drawdown and revenue growth.
 */
export function linearScore(
  value: number | null,
  benchmark: number | null,
  dispersion: number,
  higherIsBetter: boolean,
): number {
  if (value == null || benchmark == null) return NEUTRAL_SCORE;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(benchmark) ||
    dispersion <= 0 ||
    Number.isNaN(dispersion)
  ) {
    return INVALID_SCORE;
  }
  return zToScore((value - benchmark) / dispersion, higherIsBetter);
}

export interface WeightedScore {
  score: number;
  /** Importance relative to siblings; 0 excludes the item. */
  weight: number;
}

/**
 * Weighted mean over the *available* inputs only. The old implementation
 * pre-filled absent metrics with 50, so 2 known metrics out of 6 were silently
 * pulled 25% toward neutral — a data-availability artefact reading as a score.
 */
export function weightedMean(items: WeightedScore[]): number {
  let num = 0;
  let den = 0;
  for (const item of items) {
    if (!Number.isFinite(item.score)) continue;
    if (item.weight <= 0 || Number.isNaN(item.weight)) continue;
    num += item.score * item.weight;
    den += item.weight;
  }
  if (den === 0) return NEUTRAL_SCORE;
  return clampScore(num / den);
}

/** Share of total importance weight that was actually scored, 0-1. */
export function coverage(items: WeightedScore[]): number {
  let available = 0;
  let total = 0;
  for (const item of items) {
    if (item.weight <= 0 || Number.isNaN(item.weight)) continue;
    total += item.weight;
    if (Number.isFinite(item.score)) available += item.weight;
  }
  return total === 0 ? 0 : available / total;
}

/**
 * Effective independent sample size of a weighted metric set, normalised to
 * 0-1 by metric count (inverse-Simpson index). Several valuation metrics are
 * functions of the same earnings figure, so three "available" ones carry far
 * less information than three unrelated ones. Lands at 1 when weights are equal.
 */
export function diversity(items: WeightedScore[]): number {
  const usable = items.filter((i) => i.weight > 0 && Number.isFinite(i.score));
  const n = usable.length;
  if (n <= 1) return 0;
  let sum = 0;
  let sumSq = 0;
  for (const item of usable) {
    sum += item.weight;
    sumSq += item.weight * item.weight;
  }
  if (sumSq === 0) return 0;
  const ess = (sum * sum) / sumSq;
  return Math.max(0, Math.min(1, ess / n));
}

/**
 * Propagate per-metric uncertainty into a symmetric score interval: independent
 * metric errors on the aggregate, plus a floor for model error the metrics
 * cannot capture. An honest "72 +/- 9" beats a spurious point estimate of 72.
 *
 * @param noisePerScore standard deviation, in score points, of one metric's score
 */
export function scoreBand(
  items: WeightedScore[],
  noisePerScore: number,
  modelError: number,
  z = 1.96,
): { low: number; high: number } {
  const usable = items.filter((i) => i.weight > 0 && Number.isFinite(i.score));
  let den = 0;
  for (const item of usable) den += item.weight;
  if (den === 0) {
    return { low: 0, high: 100 };
  }
  let variance = modelError * modelError;
  for (const item of usable) {
    const w = item.weight / den;
    variance += w * w * noisePerScore * noisePerScore;
  }
  const margin = z * Math.sqrt(variance);
  return { low: -margin, high: margin };
}

/** Annualised daily log-return deviation, percent. Null under 20 observations. */
export function realisedVolatility(closes: number[]): number | null {
  if (closes.length < 20) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev <= 0 || curr <= 0 || Number.isNaN(prev) || Number.isNaN(curr)) {
      continue;
    }
    returns.push(Math.log(curr / prev));
  }
  if (returns.length < 19) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Largest peak-to-trough decline, as a negative percent. */
export function maxDrawdown(closes: number[]): number | null {
  if (closes.length < 10) return null;
  let peak = closes[0];
  let worst = 0;
  for (const close of closes) {
    if (close > peak) peak = close;
    if (peak <= 0 || Number.isNaN(peak)) continue;
    const dd = (close - peak) / peak;
    if (dd < worst) worst = dd;
  }
  return worst * 100;
}

/** Round for values that flow into the API surface. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
