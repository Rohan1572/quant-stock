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
  type CategoryWeights,
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

// Scores are recomputed at most once per this window per ticker; within the
// window the cached row in score_results is served. This is deliberately
// short since the product decision is "on-demand" scoring, not a nightly
// batch job — the cache only exists to absorb rapid repeat lookups.
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
  const profile = await provider.getProfile(ticker);
  if (!profile) throw new TickerNotFoundError(ticker);

  const fin = await provider.getFinancialSnapshot(ticker);
  const priceHistory = await provider.getPriceHistory(ticker, "1y");
  const snapshot = fin ?? EMPTY_SNAPSHOT;

  const weights = await getWeightsForSector(profile.sector);
  const { categories, categoryScores, overallScore } = computeCategories(
    profile,
    snapshot,
    weights,
  );
  const recommendation = recommendationFromScore(overallScore);
  const confidence = computeConfidence(snapshot, priceHistory);
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
    overallScore,
    recommendation,
    confidence,
    fairValueEstimate,
    categoryScores,
    categories,
    topFactors,
    riskFlags,
    explanation,
    dcfAssumptions: getDcfAssumptions(),
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

  if (
    cached &&
    Date.now() - cached.computedAt.getTime() < SCORE_CACHE_TTL_MS
  ) {
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
  fairValueEstimate: number | null;
  categoryScores: unknown;
  categories: unknown;
  topFactors: unknown;
  riskFlags: unknown;
  explanation: unknown;
  dcfAssumptions: unknown;
  computedAt: Date;
}): ComputedScore {
  return {
    ticker: row.ticker,
    overallScore: row.overallScore,
    recommendation: row.recommendation as ComputedScore["recommendation"],
    confidence: row.confidence,
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
