import { db, scoreResultsTable, scoringConfigsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../logger";
import { YahooFinanceAdapter, type DataProvider } from "./provider";
import { defaultCurrency, type Market } from "./market";
import { fetchScoringInputs } from "./scoringInputs";
import { singleFlight } from "./singleFlight";
import { resolveScoreCache } from "./scoreCachePolicy";
import {
  computeCategories,
  computeConfidence,
  recommendationFromScore,
  estimateFairValue,
  getDcfAssumptions,
  confidenceLevel,
  shrinkToConfidence,
  round,
  normalizeRecommendation,
  type CategoryWeights,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
  type DcfAssumptions,
  type ScoreRange,
} from "./scoring";
import { buildExplanation, buildTopFactors, buildRiskFlags } from "./explain";

export { TickerNotFoundError } from "./scoringInputs";

const providers: Record<Market, DataProvider> = {
  india: new YahooFinanceAdapter("india"),
  us: new YahooFinanceAdapter("us"),
};

const DEFAULT_WEIGHTS: CategoryWeights = {
  valuationWeight: 0.25,
  financialHealthWeight: 0.2,
  profitabilityWeight: 0.2,
  growthWeight: 0.15,
  riskWeight: 0.1,
  momentumWeight: 0.1,
};

// Within this window the cached row is served. Short, because scoring is
// on-demand; the cache only absorbs rapid repeat lookups.
const SCORE_CACHE_TTL_MS = 15 * 60 * 1000;
const scoreRequests = new Map<string, Promise<ComputedScore>>();

async function getWeightsForSector(
  sector: string | null,
): Promise<CategoryWeights> {
  if (sector) {
    const [override] = await db
      .select()
      .from(scoringConfigsTable)
      .where(eq(scoringConfigsTable.sector, sector))
      .limit(1);
    if (override) return toWeights(override);
  }
  const [platformDefault] = await db
    .select()
    .from(scoringConfigsTable)
    .where(isNull(scoringConfigsTable.sector))
    .limit(1);
  if (platformDefault) return toWeights(platformDefault);
  return DEFAULT_WEIGHTS;
}

function toWeights(row: {
  valuationWeight: number;
  financialHealthWeight: number;
  profitabilityWeight: number;
  growthWeight: number;
  riskWeight: number;
  momentumWeight: number;
}): CategoryWeights {
  return {
    valuationWeight: row.valuationWeight,
    financialHealthWeight: row.financialHealthWeight,
    profitabilityWeight: row.profitabilityWeight,
    growthWeight: row.growthWeight,
    riskWeight: row.riskWeight,
    momentumWeight: row.momentumWeight,
  };
}

export interface ComputedScore {
  ticker: string;
  overallScore: number;
  recommendation: ReturnType<typeof recommendationFromScore>;
  confidence: number;
  /** Qualitative read on the confidence number. */
  confidenceLevel: ConfidenceLevel;
  /** Per-component drivers behind `confidence`. */
  confidenceBreakdown: ConfidenceBreakdown;
  /** Indicative model-uncertainty band around `overallScore`. */
  scoreRange: ScoreRange;
  /** Shrunk toward neutral for uncertainty; drives the recommendation. */
  adjustedScore: number;
  /** Importance-weighted share of the model that had usable data, 0-1. */
  dataCoverage: number;
  fairValueEstimate: number | null;
  categoryScores: ReturnType<typeof computeCategories>["categoryScores"];
  categories: ReturnType<typeof computeCategories>["categories"];
  topFactors: ReturnType<typeof buildTopFactors>;
  riskFlags: string[];
  explanation: ReturnType<typeof buildExplanation>;
  dcfAssumptions: ReturnType<typeof getDcfAssumptions>;
  computedAt: Date;
}

async function computeFreshScore(
  ticker: string,
  market: Market,
): Promise<ComputedScore> {
  const {
    profile,
    financialSnapshot: fin,
    priceHistory,
  } = await fetchScoringInputs(providers[market], ticker);
  const snapshot = fin ?? EMPTY_SNAPSHOT;

  const weights = await getWeightsForSector(profile.sector);
  const { categories, categoryScores, overallScore, scoreRange, coverage } =
    computeCategories(profile, snapshot, weights, priceHistory, market);

  const { score: confidence, breakdown } = computeConfidence(
    snapshot,
    priceHistory,
    categories,
    profile.sector,
    market,
  );

  // Shrink before mapping to a recommendation, so a high score on thin
  // evidence cannot produce a confident buy call.
  const adjustedScore = round(shrinkToConfidence(overallScore, confidence), 1);
  const recommendation = recommendationFromScore(adjustedScore);
  const fairValueEstimate = estimateFairValue(
    snapshot,
    snapshot.revenueGrowth,
    profile.sector,
    market,
  );
  const explanation = buildExplanation(
    profile,
    categories,
    overallScore,
    adjustedScore,
    recommendation,
  );
  const topFactors = buildTopFactors(categories);
  const riskFlags = buildRiskFlags(snapshot, categories, profile.sector);

  return {
    ticker,
    overallScore: round(overallScore, 1),
    recommendation,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    confidenceBreakdown: breakdown,
    scoreRange: {
      low: round(scoreRange.low, 1),
      high: round(scoreRange.high, 1),
    },
    adjustedScore,
    dataCoverage: round(coverage, 3),
    fairValueEstimate,
    categoryScores,
    categories,
    topFactors,
    riskFlags,
    explanation,
    dcfAssumptions: getDcfAssumptions(snapshot, snapshot.revenueGrowth, market),
    computedAt: new Date(),
  };
}

const EMPTY_SNAPSHOT = {
  peRatio: null,
  forwardPe: null,
  pbRatio: null,
  evEbitda: null,
  pegRatio: null,
  roe: null,
  roa: null,
  grossMargin: null,
  operatingMargin: null,
  netMargin: null,
  debtToEquity: null,
  currentRatio: null,
  quickRatio: null,
  revenueGrowth: null,
  earningsGrowth: null,
  freeCashflow: null,
  operatingCashflow: null,
  totalCash: null,
  totalDebt: null,
  beta: null,
  fiftyDayAverage: null,
  twoHundredDayAverage: null,
  fiftyTwoWeekHigh: null,
  fiftyTwoWeekLow: null,
  sharesOutstanding: null,
  ebitda: null,
  totalRevenue: null,
  netIncome: null,
};

export function getScore(
  ticker: string,
  market: Market = "india",
): Promise<ComputedScore> {
  const normalized = ticker.toUpperCase();
  return singleFlight(scoreRequests, `${market}:${normalized}`, () =>
    loadScore(normalized, market),
  );
}

async function loadScore(
  normalized: string,
  market: Market,
): Promise<ComputedScore> {
  const [cached] = await db
    .select()
    .from(scoreResultsTable)
    .where(
      and(
        eq(scoreResultsTable.market, market),
        eq(scoreResultsTable.ticker, normalized),
      ),
    )
    .limit(1);

  return resolveScoreCache({
    cached: cached
      ? {
          value: cached,
          computedAt: cached.computedAt,
          dcfAssumptions: cached.dcfAssumptions,
        }
      : null,
    now: Date.now(),
    ttlMs: SCORE_CACHE_TTL_MS,
    compute: () => computeFreshScore(normalized, market),
    mapCached: rowToComputedScore,
    onStale: (err) => {
      logger.warn(
        { err, ticker: normalized },
        "Score recompute failed, serving stale cache",
      );
    },
    persist: async (fresh) => {
      await db
        .insert(scoreResultsTable)
        .values({
          ticker: normalized,
          market,
          computedAt: fresh.computedAt,
          overallScore: fresh.overallScore,
          recommendation: fresh.recommendation,
          confidence: fresh.confidence,
          confidenceLevel: fresh.confidenceLevel,
          confidenceBreakdown: fresh.confidenceBreakdown,
          scoreRange: fresh.scoreRange,
          adjustedScore: fresh.adjustedScore,
          dataCoverage: fresh.dataCoverage,
          fairValueEstimate: fresh.fairValueEstimate,
          categoryScores: fresh.categoryScores,
          categories: fresh.categories,
          topFactors: fresh.topFactors,
          riskFlags: fresh.riskFlags,
          explanation: fresh.explanation,
          dcfAssumptions: fresh.dcfAssumptions,
        })
        .onConflictDoUpdate({
          target: [scoreResultsTable.market, scoreResultsTable.ticker],
          set: {
            computedAt: fresh.computedAt,
            overallScore: fresh.overallScore,
            recommendation: fresh.recommendation,
            confidence: fresh.confidence,
            confidenceLevel: fresh.confidenceLevel,
            confidenceBreakdown: fresh.confidenceBreakdown,
            scoreRange: fresh.scoreRange,
            adjustedScore: fresh.adjustedScore,
            dataCoverage: fresh.dataCoverage,
            fairValueEstimate: fresh.fairValueEstimate,
            categoryScores: fresh.categoryScores,
            categories: fresh.categories,
            topFactors: fresh.topFactors,
            riskFlags: fresh.riskFlags,
            explanation: fresh.explanation,
            dcfAssumptions: fresh.dcfAssumptions,
          },
        });
    },
  });
}

function rowToComputedScore(row: {
  ticker: string;
  market: string;
  overallScore: number;
  recommendation: string;
  confidence: number;
  confidenceLevel: string | null;
  confidenceBreakdown: unknown;
  scoreRange: unknown;
  adjustedScore: number | null;
  dataCoverage: number | null;
  fairValueEstimate: number | null;
  categoryScores: unknown;
  categories: unknown;
  topFactors: unknown;
  riskFlags: unknown;
  explanation: unknown;
  dcfAssumptions: unknown;
  computedAt: Date;
}): ComputedScore {
  // Rows predating the score-range columns fall back to a degenerate band at the
  // score so old cached rows still render.
  const range = row.scoreRange as ScoreRange | null;
  const dcf = normalizeDcfAssumptions(row.dcfAssumptions);
  const recommendation = normalizeRecommendation(row.recommendation);
  const adjustedScore = row.adjustedScore ?? row.overallScore;
  const categories = row.categories as ComputedScore["categories"];
  const riskFlags = row.riskFlags as string[];
  const explanation = dcf.legacy
    ? buildExplanation(
        {
          ticker: row.ticker,
          companyName: row.ticker,
          sector: null,
          industry: null,
          marketCap: null,
          currency: row.market === "us" ? defaultCurrency("us") : "INR",
          price: null,
          changePercent: null,
        },
        categories,
        row.overallScore,
        adjustedScore,
        recommendation,
      )
    : (row.explanation as ComputedScore["explanation"]);
  return {
    ticker: row.ticker,
    overallScore: row.overallScore,
    recommendation,
    confidence: row.confidence,
    confidenceLevel: (row.confidenceLevel ??
      "moderate") as ComputedScore["confidenceLevel"],
    confidenceBreakdown:
      (row.confidenceBreakdown as ConfidenceBreakdown) ?? EMPTY_BREAKDOWN,
    scoreRange: range ?? { low: row.overallScore, high: row.overallScore },
    adjustedScore,
    dataCoverage: row.dataCoverage ?? 0,
    fairValueEstimate: dcf.legacy ? null : row.fairValueEstimate,
    categoryScores: row.categoryScores as ComputedScore["categoryScores"],
    categories,
    topFactors: row.topFactors as ComputedScore["topFactors"],
    riskFlags: dcf.legacy
      ? [
          ...riskFlags,
          "Cached score predates the current scoring method; the DCF estimate is withheld.",
        ]
      : riskFlags,
    explanation,
    dcfAssumptions: dcf.assumptions,
    computedAt: row.computedAt,
  };
}

function normalizeDcfAssumptions(value: unknown): {
  assumptions: DcfAssumptions;
  legacy: boolean;
} {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cached DCF assumptions are invalid");
  }
  const row = value as Record<string, unknown>;
  const legacy =
    typeof row.discountRate !== "number" ||
    row.discountRateType === "legacy_wacc";
  const discountRate =
    typeof row.discountRate === "number" ? row.discountRate : row.wacc;
  const discountRateType = legacy ? "legacy_wacc" : row.discountRateType;
  if (
    typeof discountRate !== "number" ||
    (discountRateType !== "cost_of_equity" &&
      discountRateType !== "legacy_wacc") ||
    typeof row.terminalGrowthRate !== "number" ||
    typeof row.projectionYears !== "number" ||
    typeof row.riskFreeRate !== "number" ||
    typeof row.equityRiskPremium !== "number" ||
    typeof row.beta !== "number" ||
    (row.initialGrowthRate !== null &&
      typeof row.initialGrowthRate !== "number") ||
    typeof row.terminalYearGrowthRate !== "number"
  ) {
    throw new Error("Cached DCF assumptions are incomplete");
  }
  return {
    assumptions: {
      discountRate,
      discountRateType,
      terminalGrowthRate: row.terminalGrowthRate,
      projectionYears: row.projectionYears,
      riskFreeRate: row.riskFreeRate,
      equityRiskPremium: row.equityRiskPremium,
      beta: row.beta,
      initialGrowthRate: row.initialGrowthRate,
      terminalYearGrowthRate: row.terminalYearGrowthRate,
    },
    legacy,
  };
}

const EMPTY_BREAKDOWN: ConfidenceBreakdown = {
  dataCoverage: 0,
  metricDiversity: 0,
  dataQuality: 0,
  benchmarkQuality: 0,
  historyQuality: 0,
};

export async function getProfile(ticker: string, market: Market = "india") {
  return providers[market].getProfile(ticker.toUpperCase());
}

export async function searchTickers(query: string, market: Market = "india") {
  return providers[market].search(query);
}

export async function getHistory(
  ticker: string,
  range: "1m" | "6m" | "1y" | "5y",
  market: Market = "india",
) {
  return providers[market].getPriceHistory(ticker.toUpperCase(), range);
}
