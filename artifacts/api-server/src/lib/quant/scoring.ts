import type { FinancialSnapshot, PricePoint, StockProfile } from "./provider";
import { getSectorBenchmark, type SectorBenchmark } from "./sectorBenchmarks";

export type Recommendation =
  | "strong_buy"
  | "buy"
  | "hold"
  | "reduce"
  | "sell"
  | "strong_short";

export interface CategoryScores {
  valuation: number;
  financialHealth: number;
  profitability: number;
  growth: number;
  risk: number;
  momentum: number;
}

export interface MetricDetail {
  key: string;
  label: string;
  value: number | null;
  sectorBenchmark: number | null;
  score: number;
  higherIsBetter: boolean;
}

export interface CategoryDetail {
  category: string;
  weight: number;
  score: number;
  metrics: MetricDetail[];
}

export interface DcfAssumptions {
  wacc: number;
  terminalGrowthRate: number;
  projectionYears: number;
}

export interface CategoryWeights {
  valuationWeight: number;
  financialHealthWeight: number;
  profitabilityWeight: number;
  growthWeight: number;
  riskWeight: number;
  momentumWeight: number;
}

// Clamp any raw score to the 0-100 scale used throughout the model.
function clampScore(value: number): number {
  if (Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, value));
}

// Score a metric against a benchmark: values better than the benchmark push
// the score above 50, worse values push it below. `higherIsBetter` controls
// direction (e.g. ROE: higher is better; P/E: lower is better).
function scoreAgainstBenchmark(
  value: number | null,
  benchmark: number,
  higherIsBetter: boolean,
  sensitivity = 50,
): number {
  if (value == null || benchmark === 0) return 50;
  const ratio = (value - benchmark) / Math.abs(benchmark);
  const delta = higherIsBetter ? ratio : -ratio;
  return clampScore(50 + delta * sensitivity);
}

function average(scores: number[]): number {
  if (scores.length === 0) return 50;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

function metric(
  key: string,
  label: string,
  value: number | null,
  benchmark: number,
  higherIsBetter: boolean,
  sensitivity = 50,
): MetricDetail {
  return {
    key,
    label,
    value,
    sectorBenchmark: benchmark,
    score: scoreAgainstBenchmark(value, benchmark, higherIsBetter, sensitivity),
    higherIsBetter,
  };
}

export function scoreValuation(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
): CategoryDetail {
  const metrics = [
    metric("peRatio", "P/E Ratio", fin.peRatio, bench.peRatio, false),
    metric("pbRatio", "P/B Ratio", fin.pbRatio, bench.pbRatio, false),
    metric("evEbitda", "EV/EBITDA", fin.evEbitda, bench.evEbitda, false),
    metric("pegRatio", "PEG Ratio", fin.pegRatio, bench.pegRatio, false),
  ];
  return {
    category: "valuation",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export function scoreFinancialHealth(fin: FinancialSnapshot): CategoryDetail {
  const metrics = [
    metric("debtToEquity", "Debt / Equity", fin.debtToEquity, 0.6, false, 60),
    metric("currentRatio", "Current Ratio", fin.currentRatio, 1.5, true, 40),
    metric("quickRatio", "Quick Ratio", fin.quickRatio, 1.0, true, 40),
    metric(
      "freeCashflow",
      "Free Cash Flow",
      fin.freeCashflow,
      fin.freeCashflow != null ? Math.abs(fin.freeCashflow) * 0 + 1 : 1,
      true,
      0,
    ),
  ];
  // FCF benchmark is company-scale dependent, so we score it as a simple
  // positive/negative signal rather than against a fixed number.
  const fcfMetric = metrics[3];
  fcfMetric.score = fin.freeCashflow == null ? 50 : fin.freeCashflow > 0 ? 70 : 30;
  fcfMetric.sectorBenchmark = null;

  return {
    category: "financialHealth",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export function scoreProfitability(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
): CategoryDetail {
  const metrics = [
    metric("roe", "Return on Equity (%)", fin.roe, bench.roe, true),
    metric("roa", "Return on Assets (%)", fin.roa, bench.roa, true),
    metric(
      "grossMargin",
      "Gross Margin (%)",
      fin.grossMargin,
      bench.grossMargin,
      true,
    ),
    metric(
      "operatingMargin",
      "Operating Margin (%)",
      fin.operatingMargin,
      bench.operatingMargin,
      true,
    ),
    metric(
      "netMargin",
      "Net Margin (%)",
      fin.netMargin,
      bench.netMargin,
      true,
    ),
  ];
  return {
    category: "profitability",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export function scoreGrowth(fin: FinancialSnapshot): CategoryDetail {
  const metrics = [
    metric(
      "revenueGrowth",
      "Revenue Growth (%)",
      fin.revenueGrowth,
      8,
      true,
      40,
    ),
    metric(
      "earningsGrowth",
      "Earnings Growth (%)",
      fin.earningsGrowth,
      10,
      true,
      40,
    ),
  ];
  return {
    category: "growth",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export function scoreRisk(
  fin: FinancialSnapshot,
  bench: SectorBenchmark,
): CategoryDetail {
  const metrics = [
    metric("beta", "Beta", fin.beta, 1.0, false, 35),
    metric(
      "debtToEquity",
      "Debt / Equity",
      fin.debtToEquity,
      bench.debtToEquity,
      false,
      45,
    ),
  ];
  return {
    category: "risk",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export function scoreMomentum(
  profile: StockProfile,
  fin: FinancialSnapshot,
): CategoryDetail {
  const price = profile.price;
  const vs50 =
    price != null && fin.fiftyDayAverage
      ? ((price - fin.fiftyDayAverage) / fin.fiftyDayAverage) * 100
      : null;
  const vs200 =
    price != null && fin.twoHundredDayAverage
      ? ((price - fin.twoHundredDayAverage) / fin.twoHundredDayAverage) * 100
      : null;
  const vsHigh =
    price != null && fin.fiftyTwoWeekHigh
      ? ((price - fin.fiftyTwoWeekHigh) / fin.fiftyTwoWeekHigh) * 100
      : null;

  const metrics = [
    metric("vs50DayAvg", "Price vs 50-Day Avg (%)", vs50, 0, true, 3),
    metric("vs200DayAvg", "Price vs 200-Day Avg (%)", vs200, 0, true, 2.5),
    metric("vsYearHigh", "Price vs 52-Week High (%)", vsHigh, -10, true, 2),
  ];
  return {
    category: "momentum",
    weight: 0,
    score: average(metrics.map((m) => m.score)),
    metrics,
  };
}

export interface CategoryComputation {
  categories: CategoryDetail[];
  categoryScores: CategoryScores;
  overallScore: number;
}

export function computeCategories(
  profile: StockProfile,
  fin: FinancialSnapshot,
  weights: CategoryWeights,
): CategoryComputation {
  const bench = getSectorBenchmark(profile.sector);

  const valuation = scoreValuation(fin, bench);
  const financialHealth = scoreFinancialHealth(fin);
  const profitability = scoreProfitability(fin, bench);
  const growth = scoreGrowth(fin);
  const risk = scoreRisk(fin, bench);
  const momentum = scoreMomentum(profile, fin);

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

  return { categories, categoryScores, overallScore };
}

export function recommendationFromScore(score: number): Recommendation {
  if (score >= 80) return "strong_buy";
  if (score >= 65) return "buy";
  if (score >= 45) return "hold";
  if (score >= 30) return "reduce";
  if (score >= 15) return "sell";
  return "strong_short";
}

// Confidence reflects how much underlying data we actually had — a score
// built from a handful of nulled-out metrics is a weaker signal than one
// with a full financial snapshot.
export function computeConfidence(
  fin: FinancialSnapshot,
  priceHistory: PricePoint[],
): number {
  const fields = Object.values(fin);
  const populated = fields.filter((v) => v != null).length;
  const completeness = fields.length === 0 ? 0 : populated / fields.length;
  const historyBonus = priceHistory.length >= 20 ? 1 : priceHistory.length / 20;
  return clampScore(completeness * 80 + historyBonus * 20);
}

const DCF_ASSUMPTIONS: DcfAssumptions = {
  wacc: 0.11,
  terminalGrowthRate: 0.045,
  projectionYears: 5,
};

// Simplified single-stage DCF fair value estimate, per spec §4. This is a
// deliberately simple model (flat growth-rate projection off trailing FCF,
// no scenario weighting) — it exists to give a directional fair-value
// anchor, not a precise valuation.
export function estimateFairValue(
  fin: FinancialSnapshot,
  growthRatePercent: number | null,
): number | null {
  if (
    fin.freeCashflow == null ||
    fin.freeCashflow <= 0 ||
    fin.sharesOutstanding == null ||
    fin.sharesOutstanding <= 0
  ) {
    return null;
  }

  const { wacc, terminalGrowthRate, projectionYears } = DCF_ASSUMPTIONS;
  const growthRate = Math.min(
    Math.max((growthRatePercent ?? 8) / 100, -0.1),
    0.25,
  );

  let pvOfCashflows = 0;
  let cashflow = fin.freeCashflow;
  for (let year = 1; year <= projectionYears; year++) {
    cashflow *= 1 + growthRate;
    pvOfCashflows += cashflow / Math.pow(1 + wacc, year);
  }

  const terminalValue =
    (cashflow * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
  const pvOfTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);

  const enterpriseValue = pvOfCashflows + pvOfTerminalValue;
  const equityValue =
    enterpriseValue + (fin.totalCash ?? 0) - (fin.totalDebt ?? 0);

  const fairValue = equityValue / fin.sharesOutstanding;
  return fairValue > 0 ? fairValue : null;
}

export function getDcfAssumptions(): DcfAssumptions {
  return DCF_ASSUMPTIONS;
}
