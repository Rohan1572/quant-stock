import type { FinancialSnapshot, PricePoint, StockProfile } from "./provider";
import {
  getSectorBenchmark,
  hasSectorBenchmark,
  DISPERSION,
  GROWTH_DISPERSION,
  MOMENTUM_DISPERSION,
  RISK_DISPERSION,
  VOLATILITY_DISPERSION,
  DRAWDOWN_DISPERSION,
  LIQUIDITY_DISPERSION,
  type SectorBenchmark,
} from "./sectorBenchmarks";
import {
  INVALID_SCORE,
  coverage,
  weightBalance,
  linearScore,
  logRatioScore,
  maxDrawdown,
  realisedVolatility,
  round,
  scoreBand,
  weightedMean,
  type WeightedScore,
} from "./statistics";

export { round } from "./statistics";

export type Recommendation =
  | "very_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "very_negative"
  | "extremely_negative";

interface CategoryScores {
  valuation: number;
  financialHealth: number;
  profitability: number;
  growth: number;
  risk: number;
  momentum: number;
}

interface MetricDetail {
  key: string;
  label: string;
  value: number | null;
  sectorBenchmark: number | null;
  score: number;
  higherIsBetter: boolean;
  /** Importance within its category, as a fraction of the category total. */
  weight: number;
  /** False when the underlying value was missing (score falls back to neutral). */
  available: boolean;
  /** False when the value existed but was economically meaningless. */
  meaningful: boolean;
}

export interface CategoryDetail {
  category: string;
  weight: number;
  score: number;
  metrics: MetricDetail[];
  /** Share of the category's intended weight that had usable data, 0-1. */
  coverage: number;
  /** Heuristic standard deviation of the category score, in score points. */
  volatility: number;
}

export interface DcfAssumptions {
  discountRate: number;
  discountRateType: "cost_of_equity" | "legacy_wacc";
  terminalGrowthRate: number;
  projectionYears: number;
  /** Discount-rate build-up, so the rate is auditable rather than magic. */
  riskFreeRate: number;
  equityRiskPremium: number;
  beta: number;
  /** Initial (year-1) growth applied to free cash flow. */
  initialGrowthRate: number | null;
  /** Growth rate assumed once the fade period ends. */
  terminalYearGrowthRate: number;
}

export interface CategoryWeights {
  valuationWeight: number;
  financialHealthWeight: number;
  profitabilityWeight: number;
  growthWeight: number;
  riskWeight: number;
  momentumWeight: number;
}

/** Point estimate plus an indicative model-uncertainty band. */
export interface ScoreRange {
  low: number;
  high: number;
}

/** The signals behind the single confidence number. */
export interface ConfidenceBreakdown {
  /** Importance-weighted share of the model that had usable data. */
  dataCoverage: number;
  /** Legacy field: how evenly available metric weights are distributed, 0-1. */
  metricDiversity: number;
  /** Data freshness and internal consistency of the snapshot. */
  dataQuality: number;
  /** Whether a sector-specific (not fallback) benchmark was available. */
  benchmarkQuality: number;
  /** Sufficiency and cleanliness of the price history series. */
  historyQuality: number;
}

export interface ConfidenceResult {
  /** Final 0-100 confidence. */
  score: number;
  breakdown: ConfidenceBreakdown;
}

/**
 * Standard deviation of one metric's score. Benchmarks are indicative rather
 * than live peer medians, so a perfect raw value cannot imply a perfect score.
 */
const METRIC_NOISE = 9;

// Model error the metrics cannot capture (management, accounting, competition),
// so the band never collapses to zero width.
const MODEL_ERROR = 7;

/** Clamp any raw score to the 0-100 scale used throughout the model. */
function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, value));
}

/** A NaN score from `scorer` marks the metric not meaningful, so it is excluded. */
function buildMetric(
  key: string,
  label: string,
  value: number | null,
  benchmark: number | null,
  higherIsBetter: boolean,
  weight: number,
  scorer: (value: number) => number,
): MetricDetail {
  const score = value == null ? 50 : scorer(value);
  const meaningful = Number.isFinite(score);
  return {
    key,
    label,
    value,
    sectorBenchmark: benchmark,
    score: meaningful ? score : 50,
    higherIsBetter,
    weight,
    available: value != null,
    meaningful,
  };
}

/** Ratio metric scored in log space against a sector multiple. */
function ratioMetric(
  key: string,
  label: string,
  value: number | null,
  benchmark: number | null,
  higherIsBetter: boolean,
  weight: number,
): MetricDetail {
  return buildMetric(
    key,
    label,
    value,
    benchmark,
    higherIsBetter,
    weight,
    (v) => logRatioScore(v, benchmark, DISPERSION.logMultiple, higherIsBetter),
  );
}

/** Percentage-point metric scored against a sector median. */
function percentMetric(
  key: string,
  label: string,
  value: number | null,
  benchmark: number | null,
  higherIsBetter: boolean,
  weight: number,
  dispersion = DISPERSION.percentPoints,
): MetricDetail {
  return buildMetric(
    key,
    label,
    value,
    benchmark,
    higherIsBetter,
    weight,
    (v) => linearScore(v, benchmark, dispersion, higherIsBetter),
  );
}

/**
 * Mark unavailable or meaningless metrics as excluded (NaN). `MetricDetail.score`
 * must stay a number for the API and so holds a neutral 50 for display, but
 * feeding that 50 into the aggregate is what made missing data dilute a score.
 */
function toWeighted(details: MetricDetail[]): WeightedScore[] {
  return details.map((m) => ({
    score: m.available && m.meaningful ? m.score : INVALID_SCORE,
    weight: m.weight,
  }));
}

/**
 * How far a category score may depart from neutral, given its data coverage.
 *
 * Renormalising alone rewards a company for missing data: a loss-maker left with
 * only P/B and EV/EBITDA would read as a stellar 94 valuation purely because
 * P/E and PEG were dropped.
 */
function coverageShrink(coverageValue: number): number {
  return Math.pow(Math.max(0, Math.min(1, coverageValue)), 0.7);
}

export function isValidCategoryWeights(weights: CategoryWeights): boolean {
  const values = [
    weights.valuationWeight,
    weights.financialHealthWeight,
    weights.profitabilityWeight,
    weights.growthWeight,
    weights.riskWeight,
    weights.momentumWeight,
  ];
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    values.every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    ) &&
    total > 0 &&
    Math.abs(total - 1) <= 0.02
  );
}

/**
 * Aggregate a category, renormalising over available metrics and shrinking the
 * result toward neutral in proportion to how much of the model had data.
 */
function aggregateCategory(
  category: string,
  metrics: MetricDetail[],
): CategoryDetail {
  const items = toWeighted(metrics);
  const cov = coverage(items);
  const raw = weightedMean(items);
  const shrink = coverageShrink(cov);
  const band = scoreBand(items, METRIC_NOISE, MODEL_ERROR / 2);
  const metricSigma = (band.high - band.low) / (2 * 1.96);
  const missingDataSigma = (1 - cov) * 25;
  return {
    category,
    weight: 0,
    score: clampScore(50 + (raw - 50) * shrink),
    metrics,
    coverage: cov,
    volatility: Math.sqrt((metricSigma * shrink) ** 2 + missingDataSigma ** 2),
  };
}

// A non-positive multiple is invalid and excluded — previously a loss-making
// company scored a perfect 100 here.
export function scoreValuation(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
  sector: string | null = null,
): CategoryDetail {
  const financialSector = isFinancialSector(sector);
  const metrics = [
    ratioMetric("peRatio", "P/E Ratio", fin.peRatio, bench.peRatio, false, 0.4),
    ratioMetric("pbRatio", "P/B Ratio", fin.pbRatio, bench.pbRatio, false, 0.8),
    ratioMetric(
      "evEbitda",
      "EV/EBITDA",
      financialSector ? null : fin.evEbitda,
      bench.evEbitda,
      false,
      0.3,
    ),
    ratioMetric(
      "pegRatio",
      "PEG Ratio",
      fin.pegRatio,
      bench.pegRatio,
      false,
      0.3,
    ),
  ];
  return aggregateCategory("valuation", metrics);
}

export function scoreFinancialHealth(
  fin: FinancialSnapshot,
  profile: StockProfile,
): CategoryDetail {
  const financialSector = isFinancialSector(profile.sector);
  const fcfConversion =
    !financialSector &&
    fin.freeCashflow != null &&
    fin.netIncome != null &&
    fin.netIncome > 0
      ? (fin.freeCashflow / fin.netIncome) * 100
      : null;

  const fcfYield =
    !financialSector &&
    fin.freeCashflow != null &&
    profile.marketCap != null &&
    profile.marketCap > 0
      ? (fin.freeCashflow / profile.marketCap) * 100
      : null;

  // Yahoo free cash flow divided by net income is a cash-conversion proxy.
  const FCF_CONVERSION_BENCHMARK = 80;
  const FCF_YIELD_BENCHMARK = 4;

  const metrics = [
    percentMetric(
      "currentRatio",
      "Current Ratio",
      financialSector ? null : fin.currentRatio,
      1.5,
      true,
      0.7,
      LIQUIDITY_DISPERSION,
    ),
    percentMetric(
      "quickRatio",
      "Quick Ratio",
      financialSector ? null : fin.quickRatio,
      1.0,
      true,
      0.5,
      LIQUIDITY_DISPERSION,
    ),
    percentMetric(
      "fcfConversion",
      "Free Cash Flow / Net Income (%)",
      fcfConversion,
      FCF_CONVERSION_BENCHMARK,
      true,
      0.7,
    ),
    percentMetric(
      "fcfYield",
      "FCF Yield (%)",
      fcfYield,
      FCF_YIELD_BENCHMARK,
      true,
      0.7,
      4,
    ),
  ];
  return aggregateCategory("financialHealth", metrics);
}

function isFinancialSector(sector: string | null): boolean {
  return sector?.trim().toLowerCase() === "financial services";
}

function scoreProfitability(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
): CategoryDetail {
  const metrics = [
    percentMetric("roe", "Return on Equity (%)", fin.roe, bench.roe, true, 0.8),
    percentMetric("roa", "Return on Assets (%)", fin.roa, bench.roa, true, 1),
    percentMetric(
      "grossMargin",
      "Gross Margin (%)",
      fin.grossMargin,
      bench.grossMargin,
      true,
      0.6,
      15,
    ),
    percentMetric(
      "operatingMargin",
      "Operating Margin (%)",
      fin.operatingMargin,
      bench.operatingMargin,
      true,
      0.8,
      10,
    ),
    percentMetric(
      "netMargin",
      "Net Margin (%)",
      fin.netMargin,
      bench.netMargin,
      true,
      0.6,
      8,
    ),
  ];
  return aggregateCategory("profitability", metrics);
}

// Earnings growth gets a wider dispersion than revenue growth: it is noisier off
// a small base, and one scale let it dominate the category.
function scoreGrowth(fin: FinancialSnapshot): CategoryDetail {
  const metrics = [
    percentMetric(
      "revenueGrowth",
      "Revenue Growth (%)",
      fin.revenueGrowth,
      8,
      true,
      1,
      GROWTH_DISPERSION,
    ),
    percentMetric(
      "earningsGrowth",
      "Earnings Growth (%)",
      fin.earningsGrowth,
      10,
      true,
      1,
      30,
    ),
  ];
  return aggregateCategory("growth", metrics);
}

// Beta alone is a backward-looking regression that understates tail risk.
export function scoreRisk(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
  priceHistory: PricePoint[],
  sector: string | null = null,
): CategoryDetail {
  const closes = priceHistory.map((p) => p.close).filter((c) => c > 0);
  const vol = realisedVolatility(closes);
  const drawdown = maxDrawdown(closes);

  const metrics = [
    // Outside (0, 3) is a data artefact for illiquid names, so invalid.
    buildMetric(
      "beta",
      "Beta",
      fin.beta != null && fin.beta > 0 && fin.beta < 3 ? fin.beta : null,
      1.0,
      false,
      0.8,
      (v) => linearScore(v, 1.0, RISK_DISPERSION, false),
    ),
    percentMetric(
      "debtToEquity",
      "Debt / Equity",
      isFinancialSector(sector) ||
        fin.debtToEquity == null ||
        !Number.isFinite(fin.debtToEquity) ||
        fin.debtToEquity < 0
        ? null
        : fin.debtToEquity,
      bench.debtToEquity,
      false,
      1,
      DISPERSION.ratio,
    ),
    percentMetric(
      "realisedVolatility",
      "Realised Volatility (%)",
      vol,
      28,
      false,
      1,
      VOLATILITY_DISPERSION,
    ),
    percentMetric(
      "maxDrawdown",
      "Max Drawdown (%)",
      drawdown,
      -30,
      true,
      1,
      DRAWDOWN_DISPERSION,
    ),
  ];
  return aggregateCategory("risk", metrics);
}

// The 50-day and 200-day metrics previously used a benchmark of exactly 0, which
// the old transform short-circuited to a flat 50 — a price 40% above or below
// the average scored identically. A benchmark ratio of 1.0 means "at the average".
export function scoreMomentum(
  profile: StockProfile,
  fin: FinancialSnapshot,
  priceHistory: PricePoint[],
): CategoryDetail {
  const price = profile.price;
  const closes = priceHistory.map((p) => p.close).filter((c) => c > 0);

  // As a ratio, so "+5% above" and "5% below" the average score symmetrically.
  const vs50 =
    price != null && fin.fiftyDayAverage && fin.fiftyDayAverage > 0
      ? price / fin.fiftyDayAverage
      : null;
  const vs200 =
    price != null && fin.twoHundredDayAverage && fin.twoHundredDayAverage > 0
      ? price / fin.twoHundredDayAverage
      : null;
  const vsHigh =
    price != null && fin.fiftyTwoWeekHigh && fin.fiftyTwoWeekHigh > 0
      ? price / fin.fiftyTwoWeekHigh
      : null;

  // 6-month price return, percent.
  let return6m: number | null = null;
  if (closes.length >= 120) {
    const past = closes[closes.length - 121];
    const now = closes[closes.length - 1];
    if (past > 0) return6m = ((now - past) / past) * 100;
  }

  const metrics = [
    ratioMetric("vs50DayAvg", "Price vs 50-Day Avg", vs50, 1.0, true, 0.25),
    ratioMetric("vs200DayAvg", "Price vs 200-Day Avg", vs200, 1.0, true, 0.25),
    ratioMetric("vsYearHigh", "Price vs 52-Week High", vsHigh, 1.0, true, 0.5),
    percentMetric(
      "return6m",
      "6-Month Return (%)",
      return6m,
      0,
      true,
      0.5,
      MOMENTUM_DISPERSION,
    ),
  ];
  return aggregateCategory("momentum", metrics);
}

export interface CategoryComputation {
  categories: CategoryDetail[];
  categoryScores: CategoryScores;
  overallScore: number;
  /** Indicative model-uncertainty band around the overall score. */
  scoreRange: ScoreRange;
  /** Importance-weighted coverage of the whole model, 0-1. */
  coverage: number;
}

export function computeCategories(
  profile: StockProfile,
  fin: FinancialSnapshot,
  weights: CategoryWeights,
  priceHistory: PricePoint[] = [],
): CategoryComputation {
  if (!isValidCategoryWeights(weights)) {
    throw new RangeError(
      "Category weights must be finite values from 0 to 1 and sum to 1.0",
    );
  }

  const bench = getSectorBenchmark(profile.sector);

  const valuation = scoreValuation(fin, bench, profile.sector);
  const financialHealth = scoreFinancialHealth(fin, profile);
  const profitability = scoreProfitability(fin, bench);
  const growth = scoreGrowth(fin);
  const risk = scoreRisk(fin, bench, priceHistory, profile.sector);
  const momentum = scoreMomentum(profile, fin, priceHistory);

  valuation.weight = weights.valuationWeight;
  financialHealth.weight = weights.financialHealthWeight;
  profitability.weight = weights.profitabilityWeight;
  growth.weight = weights.growthWeight;
  risk.weight = weights.riskWeight;
  momentum.weight = weights.momentumWeight;

  const categories = [
    valuation,
    financialHealth,
    profitability,
    growth,
    risk,
    momentum,
  ];

  const categoryScores: CategoryScores = {
    valuation: valuation.score,
    financialHealth: financialHealth.score,
    profitability: profitability.score,
    growth: growth.score,
    risk: risk.score,
    momentum: momentum.score,
  };

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0) || 1;
  const overallScore = clampScore(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight,
  );

  // Heuristic uncertainty propagation; this is not a calibrated statistical
  // confidence interval.
  const variance = categories.reduce((sum, category) => {
    const weight = category.weight / totalWeight;
    return sum + weight * weight * category.volatility * category.volatility;
  }, MODEL_ERROR * MODEL_ERROR);
  const margin = 1.96 * Math.sqrt(variance);

  const overallCoverage =
    categories.reduce((sum, c) => sum + c.coverage * c.weight, 0) / totalWeight;

  return {
    categories,
    categoryScores,
    overallScore,
    scoreRange: {
      low: clampScore(overallScore - margin),
      high: clampScore(overallScore + margin),
    },
    coverage: overallCoverage,
  };
}

// Conservative at the top end: on indicative benchmarks, "high" is a high bar.
export type ConfidenceLevel = "low" | "moderate" | "high";

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  return "low";
}

export function recommendationFromScore(score: number): Recommendation {
  if (score >= 80) return "very_positive";
  if (score >= 65) return "positive";
  if (score >= 45) return "neutral";
  if (score >= 30) return "negative";
  if (score >= 15) return "very_negative";
  return "extremely_negative";
}

export function normalizeRecommendation(value: string): Recommendation {
  const legacy: Record<string, Recommendation> = {
    strong_buy: "very_positive",
    buy: "positive",
    hold: "neutral",
    reduce: "negative",
    sell: "very_negative",
    strong_short: "extremely_negative",
  };
  if (
    value === "very_positive" ||
    value === "positive" ||
    value === "neutral" ||
    value === "negative" ||
    value === "very_negative" ||
    value === "extremely_negative"
  ) {
    return value;
  }
  const normalized = legacy[value];
  if (normalized) return normalized;
  throw new Error(`Unknown scoring recommendation: ${value}`);
}

/**
 * Shrink a score toward neutral in proportion to uncertainty. At confidence 100
 * the score is untouched; at 0 it collapses to 50, which maps to a neutral
 * screening rating rather than overstating a thinly evidenced signal.
 */
export function shrinkToConfidence(score: number, confidence: number): number {
  const c = Math.max(0, Math.min(100, confidence)) / 100;
  return clampScore(50 + (score - 50) * c);
}

// Coverage dominates: it reflects how much of the model had data behind it.
const CONFIDENCE_WEIGHTS = {
  dataCoverage: 0.4,
  metricWeightBalance: 0.15,
  dataQuality: 0.15,
  benchmarkQuality: 0.1,
  historyQuality: 0.2,
} as const;

// Inconsistent values signal a stale or mis-mapped feed, not a characteristic.
function computeDataQuality(fin: FinancialSnapshot): number {
  let quality = 1;

  // Positive P/E with negative net income is contradictory; one is stale.
  if (
    fin.peRatio != null &&
    fin.peRatio > 0 &&
    fin.netIncome != null &&
    fin.netIncome < 0
  ) {
    quality -= 0.5;
  }

  // Margins outside [-100, 100] are arithmetically impossible.
  for (const margin of [fin.grossMargin, fin.operatingMargin, fin.netMargin]) {
    if (margin != null && (margin > 100 || margin < -100)) quality -= 0.25;
  }

  // Negative debt-to-equity alongside positive reported debt is contradictory.
  if (
    fin.debtToEquity != null &&
    fin.debtToEquity < 0 &&
    (fin.totalDebt ?? 0) > 0
  ) {
    quality -= 0.25;
  }

  // Yahoo occasionally emits sentinel values; treat them as absent.
  for (const value of Object.values(fin)) {
    if (typeof value === "number" && !Number.isFinite(value)) quality -= 0.25;
  }

  return Math.max(0, Math.min(1, quality));
}

// Enough observations to mean something, recent enough to describe today, and
// actually moving. A flat or stale series yields useless estimates.
function computeHistoryQuality(priceHistory: PricePoint[]): number {
  if (priceHistory.length === 0) return 0;

  // ~120 trading days needed for the 6-month return; 20 for volatility.
  const lengthScore = Math.min(priceHistory.length / 120, 1);

  const last = priceHistory[priceHistory.length - 1]?.date;
  let recencyScore = 0.5;
  if (last) {
    const ageDays = (Date.now() - new Date(last).getTime()) / 86_400_000;
    // Full credit under 5 days, decaying to zero at 45.
    recencyScore = Math.max(0, Math.min(1, (45 - ageDays) / 40));
  }

  const distinct = new Set(priceHistory.map((p) => p.close)).size;
  const varietyScore =
    priceHistory.length < 2
      ? 0
      : Math.min(distinct / priceHistory.length / 0.5, 1);

  return lengthScore * recencyScore * varietyScore;
}

/**
 * Confidence in how much data actually backed this score.
 *
 * Coverage covers the metrics scoring actually uses, weighted by importance —
 * the old version counted all 28 snapshot fields equally, including six that
 * scoring never touches.
 */
export function computeConfidence(
  fin: FinancialSnapshot,
  priceHistory: PricePoint[],
  categories: CategoryDetail[] = [],
  sector: string | null = null,
): ConfidenceResult {
  let dataCoverage: number;
  if (categories.length > 0) {
    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0) || 1;
    dataCoverage =
      categories.reduce((sum, c) => sum + c.coverage * c.weight, 0) /
      totalWeight;
  } else {
    // Fallback for direct callers: measure only the fields scoring uses.
    const scoredFields: (number | null)[] = [
      fin.peRatio,
      fin.pbRatio,
      fin.evEbitda,
      fin.pegRatio,
      fin.debtToEquity,
      fin.currentRatio,
      fin.quickRatio,
      fin.freeCashflow,
      fin.roe,
      fin.roa,
      fin.grossMargin,
      fin.operatingMargin,
      fin.netMargin,
      fin.revenueGrowth,
      fin.earningsGrowth,
      fin.beta,
      fin.fiftyDayAverage,
      fin.twoHundredDayAverage,
      fin.fiftyTwoWeekHigh,
    ];
    const present = scoredFields.filter((v) => v != null).length;
    dataCoverage = present / scoredFields.length;
  }

  const totalCategoryWeight =
    categories.reduce((sum, c) => sum + c.weight, 0) || 1;
  const metricWeightBalance =
    categories.length > 0
      ? categories.reduce(
          (acc, c) => acc + weightBalance(toWeighted(c.metrics)) * c.weight,
          0,
        ) / totalCategoryWeight
      : 0.5;

  const dataQuality = computeDataQuality(fin);
  // No sector match means every comparison used broad-market defaults, a weaker
  // reference than true peer medians.
  // A matched sector benchmark is an indicative static table, not live peer
  // medians, so it scores below perfect; broad-market defaults are weaker.
  const benchmarkQuality = hasSectorBenchmark(sector) ? 0.85 : 0.4;
  const historyQuality = computeHistoryQuality(priceHistory);

  const breakdown: ConfidenceBreakdown = {
    dataCoverage: round(dataCoverage, 3),
    metricDiversity: round(metricWeightBalance, 3),
    dataQuality: round(dataQuality, 3),
    benchmarkQuality: round(benchmarkQuality, 3),
    historyQuality: round(historyQuality, 3),
  };

  // Reference-data quality (benchmarks, price history) is only worth anything in
  // proportion to how much model it is judging, so it is gated by coverage.
  // Without the gate, a stock with none of its financial data still scored ~52%
  // confidence purely for having a clean price series.
  //
  // Already weighted, and summing to at most (1 - dataCoverage), so the bracket
  // tops out at exactly 1.0 when every component is maximal.
  const gated =
    metricWeightBalance * CONFIDENCE_WEIGHTS.metricWeightBalance +
    dataQuality * CONFIDENCE_WEIGHTS.dataQuality +
    benchmarkQuality * CONFIDENCE_WEIGHTS.benchmarkQuality +
    historyQuality * CONFIDENCE_WEIGHTS.historyQuality;

  const score = dataCoverage * (CONFIDENCE_WEIGHTS.dataCoverage + gated);

  return { score: round(clampScore(score * 100), 1), breakdown };
}

const RISK_FREE_RATE = 0.065; // India 10Y government bond, approximate
const EQUITY_RISK_PREMIUM = 0.055; // mature-market ERP
const COUNTRY_RISK_PREMIUM = 0.015; // India country risk
const TERMINAL_GROWTH_RATE = 0.045; // capped well below nominal GDP
const DEFAULT_BETA = 1.0;
const FADE_YEARS = 10;
// Blume adjustment: shrink raw beta two-thirds of the way toward 1.0. Published
// betas are noisy and mean-reverting; the adjustment corrects the well-documented
// tendency of raw betas to understate systematic risk.
const BLUME_BETA_WEIGHT = 1 / 3;

// Yahoo free cash flow is operating cash flow less capex, so it is treated as
// an equity-cash-flow proxy and discounted at cost of equity, without a second
// debt/cash adjustment.
function computeCostOfEquity(fin: FinancialSnapshot): {
  discountRate: number;
  beta: number;
} {
  const rawBeta =
    fin.beta != null && fin.beta > 0 && fin.beta < 3 ? fin.beta : DEFAULT_BETA;

  // Yahoo reports implausibly low betas for Indian NSE large caps (observed
  // 0.11-0.40 for RELIANCE/TCS/INFY/HDFCBANK, none of which are low-risk
  // businesses). Taking them at face value produced a cost of equity close to
  // the risk-free rate, overstating fair value. The Blume adjustment pulls
  // them back toward the market.
  const beta = BLUME_BETA_WEIGHT * rawBeta + (1 - BLUME_BETA_WEIGHT) * 1.0;

  const costOfEquity =
    RISK_FREE_RATE + beta * EQUITY_RISK_PREMIUM + COUNTRY_RISK_PREMIUM;

  // Keep a minimum spread over terminal growth to avoid an unstable Gordon
  // value. This remains an approximate, fixed-rate assumption.
  const discountRate = Math.min(
    Math.max(costOfEquity, TERMINAL_GROWTH_RATE + 0.03),
    0.25,
  );
  return { discountRate, beta };
}

function buildDcfAssumptions(
  fin: FinancialSnapshot,
  growthRate: number | null,
): DcfAssumptions {
  const { discountRate, beta } = computeCostOfEquity(fin);
  return {
    discountRate: round(discountRate, 4),
    discountRateType: "cost_of_equity",
    terminalGrowthRate: TERMINAL_GROWTH_RATE,
    projectionYears: FADE_YEARS,
    riskFreeRate: RISK_FREE_RATE,
    equityRiskPremium: EQUITY_RISK_PREMIUM,
    beta: round(beta, 2),
    initialGrowthRate: growthRate == null ? null : round(growthRate, 4),
    terminalYearGrowthRate: TERMINAL_GROWTH_RATE,
  };
}

/**
 * Two-stage equity DCF. Revenue growth is only a proxy for FCF growth because
 * the provider does not supply a reliable FCF-growth history.
 *
 * Still a directional anchor, not a precise valuation.
 */
export function estimateFairValue(
  fin: FinancialSnapshot,
  growthRatePercent: number | null,
  sector: string | null = null,
): number | null {
  if (
    isFinancialSector(sector) ||
    growthRatePercent == null ||
    !Number.isFinite(growthRatePercent) ||
    fin.freeCashflow == null ||
    fin.freeCashflow <= 0 ||
    fin.sharesOutstanding == null ||
    fin.sharesOutstanding <= 0
  ) {
    return null;
  }

  // Clamp the revenue-growth proxy; keep it below the discount rate.
  const { discountRate } = computeCostOfEquity(fin);
  const terminal = TERMINAL_GROWTH_RATE;
  const growthRate = Math.min(
    Math.max(growthRatePercent / 100, -0.1),
    Math.min(0.25, discountRate - 0.02),
  );

  const fcf = fin.freeCashflow;
  let pv = 0;
  let cashflow = fcf;

  for (let year = 1; year <= FADE_YEARS; year++) {
    // Linear fade from the current growth rate toward terminal growth.
    const fade = 1 - (year - 1) / FADE_YEARS;
    const yearGrowth = terminal + (growthRate - terminal) * fade;
    cashflow *= 1 + yearGrowth;
    pv += cashflow / (1 + discountRate) ** year;
  }

  const terminalValue =
    (cashflow * (1 + terminal)) / Math.max(discountRate - terminal, 0.01);
  const pvTerminal = terminalValue / (1 + discountRate) ** FADE_YEARS;
  const fairValue = (pv + pvTerminal) / fin.sharesOutstanding;
  return Number.isFinite(fairValue) && fairValue > 0
    ? round(fairValue, 2)
    : null;
}

// Returned alongside the score so the UI can show what was actually assumed
// rather than a single hardcoded number.
export function getDcfAssumptions(
  fin: FinancialSnapshot,
  growthRatePercent: number | null,
): DcfAssumptions {
  const { discountRate } = computeCostOfEquity(fin);
  if (growthRatePercent == null || !Number.isFinite(growthRatePercent)) {
    return buildDcfAssumptions(fin, null);
  }
  const growthRate = Math.min(
    Math.max(growthRatePercent / 100, -0.1),
    Math.min(0.25, discountRate - 0.02),
  );
  return buildDcfAssumptions(fin, growthRate);
}
