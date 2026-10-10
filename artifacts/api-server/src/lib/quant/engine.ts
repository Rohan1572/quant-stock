import { db, scoreResultsTable, scoringConfigsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../logger";
import { YahooFinanceAdapter, type DataProvider } from "./provider";
import {
  computeCategories,
  computeConfidence,
  recommendationFromScore,
  estimateFairValue,
  getDcfAssumptions,
  confidenceLevel,
  shrinkToConfidence,
  round,
  type CategoryWeights,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
  type ScoreRange,
} from "./scoring";
import { buildExplanation, buildTopFactors, buildRiskFlags } from "./explain";

const provider: DataProvider = new YahooFinanceAdapter();

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
  /** 95% interval around `overallScore`. */
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

export class TickerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Ticker not found: ${ticker}`);
  }
}

async function computeFreshScore(ticker: string): Promise<ComputedScore> {
  const { profile, financialSnapshot: fin } =
    await provider.getScoringData(ticker);
  if (!profile) throw new TickerNotFoundError(ticker);

  const priceHistory = await provider.getPriceHistory(ticker, "1y");
  const snapshot = fin ?? EMPTY_SNAPSHOT;

  const weights = await getWeightsForSector(profile.sector);
  const { categories, categoryScores, overallScore, scoreRange, coverage } =
    computeCategories(profile, snapshot, weights, priceHistory);

  const { score: confidence, breakdown } = computeConfidence(
    snapshot,
    priceHistory,
    categories,
    profile.sector,
  );

  // Shrink before mapping to a recommendation, so a high score on thin
  // evidence cannot produce a confident buy call.
  const adjustedScore = round(shrinkToConfidence(overallScore, confidence), 1);
  const recommendation = recommendationFromScore(adjustedScore);
  const fairValueEstimate = estimateFairValue(snapshot, snapshot.revenueGrowth);
  const explanation = buildExplanation(
    profile,
    categories,
    overallScore,
    recommendation,
  );
  const topFactors = buildTopFactors(categories);
  const riskFlags = buildRiskFlags(snapshot, categories);

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
    dcfAssumptions: getDcfAssumptions(snapshot, snapshot.revenueGrowth),
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

export async function getScore(ticker: string): Promise<ComputedScore> {
  const normalized = ticker.toUpperCase();

  const [cached] = await db
    .select()
    .from(scoreResultsTable)
    .where(eq(scoreResultsTable.ticker, normalized))
    .limit(1);

  if (cached && Date.now() - cached.computedAt.getTime() < SCORE_CACHE_TTL_MS) {
    return rowToComputedScore(cached);
  }

  let fresh: ComputedScore;
  try {
    fresh = await computeFreshScore(normalized);
  } catch (err) {
    if (cached) {
      // Upstream provider hiccup — serve the stale cache rather than fail.
      logger.warn(
        { err, ticker: normalized },
        "Score recompute failed, serving stale cache",
      );
      return rowToComputedScore(cached);
    }
    throw err;
  }

  await db
    .insert(scoreResultsTable)
    .values({
      ticker: normalized,
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
      target: scoreResultsTable.ticker,
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

  return fresh;
}

function rowToComputedScore(row: {
  ticker: string;
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
  return {
    ticker: row.ticker,
    overallScore: row.overallScore,
    recommendation: row.recommendation as ComputedScore["recommendation"],
    confidence: row.confidence,
    confidenceLevel: (row.confidenceLevel ??
      "moderate") as ComputedScore["confidenceLevel"],
    confidenceBreakdown:
      (row.confidenceBreakdown as ConfidenceBreakdown) ?? EMPTY_BREAKDOWN,
    scoreRange: range ?? { low: row.overallScore, high: row.overallScore },
    adjustedScore: row.adjustedScore ?? row.overallScore,
    dataCoverage: row.dataCoverage ?? 0,
    fairValueEstimate: row.fairValueEstimate,
    categoryScores: row.categoryScores as ComputedScore["categoryScores"],
    categories: row.categories as ComputedScore["categories"],
    topFactors: row.topFactors as ComputedScore["topFactors"],
    riskFlags: row.riskFlags as string[],
    explanation: row.explanation as ComputedScore["explanation"],
    dcfAssumptions: row.dcfAssumptions as ComputedScore["dcfAssumptions"],
    computedAt: row.computedAt,
  };
}

const EMPTY_BREAKDOWN: ConfidenceBreakdown = {
  dataCoverage: 0,
  metricDiversity: 0,
  dataQuality: 0,
  benchmarkQuality: 0,
  historyQuality: 0,
};

export async function getProfile(ticker: string) {
  return provider.getProfile(ticker.toUpperCase());
}

export async function searchTickers(query: string) {
  return provider.search(query);
}

export async function getHistory(
  ticker: string,
  range: "1m" | "6m" | "1y" | "5y",
) {
  return provider.getPriceHistory(ticker.toUpperCase(), range);
}
