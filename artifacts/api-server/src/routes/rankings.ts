import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, scoreResultsTable } from "@workspace/db";
import {
  ListRankingsResponse,
  RefreshRankingsResponse,
} from "@workspace/api-zod";
import { getScore, TickerNotFoundError } from "../lib/quant/engine";
import { normalizeRecommendation } from "../lib/quant/scoring";
import { logger } from "../lib/logger";
import { marketFromValue, type Market } from "../lib/quant/market";
import { getMarketWatchlistEntry, getWatchlist } from "../lib/quant/watchlists";

const router: IRouter = Router();

// ── Refresh rate-limiting (in-memory; resets on server restart) ───────────
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const PARTIAL_REFRESH_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SCORE_BATCH_SIZE = 5;
const SCORE_BATCH_DELAY_MS = 300; // ms between batches — be gentle with Yahoo

interface RefreshState {
  lastRefreshAt: Date | null;
  retryAvailableAt: Date | null;
  isRefreshing: boolean;
}

const refreshStates: Record<Market, RefreshState> = {
  india: { lastRefreshAt: null, retryAvailableAt: null, isRefreshing: false },
  us: { lastRefreshAt: null, retryAvailableAt: null, isRefreshing: false },
};

function nextRefreshAt(state: RefreshState): Date | null {
  if (state.retryAvailableAt) return state.retryAvailableAt;
  if (!state.lastRefreshAt) return null;
  return new Date(state.lastRefreshAt.getTime() + REFRESH_COOLDOWN_MS);
}

function canRefresh(state: RefreshState): boolean {
  if (state.isRefreshing) return false;
  if (state.retryAvailableAt) {
    return Date.now() >= state.retryAvailableAt.getTime();
  }
  if (!state.lastRefreshAt) return true;
  return Date.now() - state.lastRefreshAt.getTime() >= REFRESH_COOLDOWN_MS;
}

// ── Background scoring job ────────────────────────────────────────────────
async function scoreAllInBackground(market: Market): Promise<void> {
  const state = refreshStates[market];
  const watchlist = getWatchlist(market);
  state.isRefreshing = true;
  try {
    logger.info(
      { market, tickers: watchlist.length },
      "Rankings refresh started",
    );
    let succeeded = 0;
    let failed = 0;

    const tickers = watchlist.map((e) => e.ticker);
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
                await getScore(ticker, market);
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
      state.lastRefreshAt = new Date();
      state.retryAvailableAt = null;
      logger.info({ market, succeeded, failed }, "Rankings refresh complete");
    } else {
      state.retryAvailableAt = new Date(
        Date.now() + PARTIAL_REFRESH_RETRY_DELAY_MS,
      );
      logger.warn(
        {
          market,
          succeeded,
          failed,
          retryAvailableAt: state.retryAvailableAt,
        },
        "Rankings refresh partially complete; failed tickers can be retried",
      );
    }
  } finally {
    state.isRefreshing = false;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────
router.get("/rankings", async (req, res): Promise<void> => {
  const market = marketFromValue(req.query.market);
  if (!market) {
    res.status(400).json({ error: "market must be 'india' or 'us'" });
    return;
  }
  const state = refreshStates[market];
  const watchlist = getWatchlist(market);
  const allTickers = watchlist.map((e) => e.ticker);

  const rows =
    allTickers.length > 0
      ? await db
          .select()
          .from(scoreResultsTable)
          .where(
            and(
              eq(scoreResultsTable.market, market),
              inArray(scoreResultsTable.ticker, allTickers),
            ),
          )
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
      const meta = getMarketWatchlistEntry(market, row.ticker);
      return {
        rank: idx + 1,
        ticker: row.ticker,
        companyName: meta?.companyName ?? row.ticker,
        sector: meta?.sector ?? null,
        overallScore: row.overallScore,
        adjustedScore: row.adjustedScore ?? row.overallScore,
        recommendation: normalizeRecommendation(row.recommendation),
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
    ListRankingsResponse.parse({
      items: sorted,
      total: watchlist.length,
      scored: rows.length,
      isRefreshing: state.isRefreshing,
      lastRefreshedAt: state.lastRefreshAt?.toISOString() ?? null,
      nextRefreshAt: nextRefreshAt(state)?.toISOString() ?? null,
    }),
  );
});

router.post("/rankings/refresh", (req, res): void => {
  const market = marketFromValue(req.query.market);
  if (!market) {
    res.status(400).json({ error: "market must be 'india' or 'us'" });
    return;
  }
  const state = refreshStates[market];
  const watchlist = getWatchlist(market);
  if (!canRefresh(state)) {
    const next = nextRefreshAt(state);
    res.json(
      RefreshRankingsResponse.parse({
        status: "rate_limited",
        message: state.isRefreshing
          ? "A refresh is already in progress."
          : `Rankings were refreshed recently. Next refresh available at ${next?.toISOString()}.`,
        nextRefreshAt: next?.toISOString() ?? null,
      }),
    );
    return;
  }

  // Fire and forget — response returns immediately
  scoreAllInBackground(market).catch((err) =>
    logger.error({ err, market }, "Rankings background refresh crashed"),
  );

  res.json(
    RefreshRankingsResponse.parse({
      status: "started",
      message: `Scoring ${watchlist.length} ${market.toUpperCase()} tickers in the background. Check back in a few minutes.`,
      nextRefreshAt: null,
    }),
  );
});

export default router;
