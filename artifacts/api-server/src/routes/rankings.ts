import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
import { db, scoreResultsTable } from "@workspace/db";
import {
  GetRankingsResponse,
  RefreshRankingsResponse,
} from "@workspace/api-zod";
import { WATCHLIST, getWatchlistEntry } from "../lib/quant/nifty100";
import { getScore, TickerNotFoundError } from "../lib/quant/engine";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Refresh rate-limiting (in-memory; resets on server restart) ───────────
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const PARTIAL_REFRESH_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SCORE_BATCH_SIZE = 5;
const SCORE_BATCH_DELAY_MS = 300; // ms between batches — be gentle with Yahoo

let lastRefreshAt: Date | null = null;
let retryAvailableAt: Date | null = null;
let isRefreshing = false;

function nextRefreshAt(): Date | null {
  if (retryAvailableAt) return retryAvailableAt;
  if (!lastRefreshAt) return null;
  return new Date(lastRefreshAt.getTime() + REFRESH_COOLDOWN_MS);
}

function canRefresh(): boolean {
  if (isRefreshing) return false;
  if (retryAvailableAt) return Date.now() >= retryAvailableAt.getTime();
  if (!lastRefreshAt) return true;
  return Date.now() - lastRefreshAt.getTime() >= REFRESH_COOLDOWN_MS;
}

// ── Background scoring job ────────────────────────────────────────────────
async function scoreAllInBackground(): Promise<void> {
  isRefreshing = true;
  try {
    logger.info({ tickers: WATCHLIST.length }, "Rankings refresh started");
    let succeeded = 0;
    let failed = 0;

    const tickers = WATCHLIST.map((e) => e.ticker);
    const batches = Array.from(
      { length: Math.ceil(tickers.length / SCORE_BATCH_SIZE) },
      (_, index) =>
        tickers.slice(index * SCORE_BATCH_SIZE, (index + 1) * SCORE_BATCH_SIZE),
    );
    await batches.reduce(
      (previousBatch, batch, index) =>
        previousBatch.then(async () => {
          await Promise.all(
            batch.map(async (ticker) => {
              try {
                await getScore(ticker);
                succeeded++;
              } catch (err) {
                if (err instanceof TickerNotFoundError) {
                  // ticker delisted or not on Yahoo — skip silently
                } else {
                  logger.warn(
                    { err, ticker },
                    "Rankings: failed to score ticker",
                  );
                }
                failed++;
              }
            }),
          );
          if (index < batches.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, SCORE_BATCH_DELAY_MS),
            );
          }
        }),
      Promise.resolve(),
    );

    if (failed === 0) {
      lastRefreshAt = new Date();
      retryAvailableAt = null;
      logger.info({ succeeded, failed }, "Rankings refresh complete");
    } else {
      retryAvailableAt = new Date(Date.now() + PARTIAL_REFRESH_RETRY_DELAY_MS);
      logger.warn(
        { succeeded, failed, retryAvailableAt },
        "Rankings refresh partially complete; failed tickers can be retried",
      );
    }
  } finally {
    isRefreshing = false;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────
router.get("/rankings", async (_req, res): Promise<void> => {
  const allTickers = WATCHLIST.map((e) => e.ticker);

  const rows =
    allTickers.length > 0
      ? await db
          .select()
          .from(scoreResultsTable)
          .where(inArray(scoreResultsTable.ticker, allTickers))
      : [];

  // Rank on the confidence-adjusted score: ranking on the raw score favours
  // thinly-covered stocks. Ties break on confidence then ticker for a stable
  // ordering across refreshes.
  const sorted = [...rows]
    .sort((a, b) => {
      const adjustedDelta =
        (b.adjustedScore ?? b.overallScore) -
        (a.adjustedScore ?? a.overallScore);
      if (Math.abs(adjustedDelta) > 1e-9) return adjustedDelta;
      if (Math.abs(b.confidence - a.confidence) > 1e-9) {
        return b.confidence - a.confidence;
      }
      return a.ticker.localeCompare(b.ticker);
    })
    .map((row, idx) => {
      const meta = getWatchlistEntry(row.ticker);
      return {
        rank: idx + 1,
        ticker: row.ticker,
        companyName: meta?.companyName ?? row.ticker,
        sector: meta?.sector ?? null,
        overallScore: row.overallScore,
        recommendation: row.recommendation,
        confidence: row.confidence,
        confidenceLevel: row.confidenceLevel,
        scoreRange: (row.scoreRange as {
          low: number;
          high: number;
        } | null) ?? {
          low: row.overallScore,
          high: row.overallScore,
        },
        computedAt: row.computedAt.toISOString(),
      };
    });

  res.json(
    GetRankingsResponse.parse({
      items: sorted,
      total: WATCHLIST.length,
      scored: rows.length,
      isRefreshing,
      lastRefreshedAt: lastRefreshAt?.toISOString() ?? null,
      nextRefreshAt: nextRefreshAt()?.toISOString() ?? null,
    }),
  );
});

router.post("/rankings/refresh", (_req, res): void => {
  if (!canRefresh()) {
    const next = nextRefreshAt();
    res.json(
      RefreshRankingsResponse.parse({
        status: "rate_limited",
        message: isRefreshing
          ? "A refresh is already in progress."
          : `Rankings were refreshed recently. Next refresh available at ${next?.toISOString()}.`,
        nextRefreshAt: next?.toISOString() ?? null,
      }),
    );
    return;
  }

  // Fire and forget — response returns immediately
  scoreAllInBackground().catch((err) =>
    logger.error({ err }, "Rankings background refresh crashed"),
  );

  res.json(
    RefreshRankingsResponse.parse({
      status: "started",
      message: `Scoring ${WATCHLIST.length} tickers in the background. Check back in a few minutes.`,
      nextRefreshAt: null,
    }),
  );
});

export default router;
