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
const SCORE_BATCH_SIZE = 5;
const SCORE_BATCH_DELAY_MS = 300; // ms between batches — be gentle with Yahoo

let lastRefreshAt: Date | null = null;
let isRefreshing = false;

function nextRefreshAt(): Date | null {
  if (!lastRefreshAt) return null;
  return new Date(lastRefreshAt.getTime() + REFRESH_COOLDOWN_MS);
}

function canRefresh(): boolean {
  if (isRefreshing) return false;
  if (!lastRefreshAt) return true;
  return Date.now() - lastRefreshAt.getTime() >= REFRESH_COOLDOWN_MS;
}

// ── Background scoring job ────────────────────────────────────────────────
async function scoreAllInBackground(): Promise<void> {
  isRefreshing = true;
  logger.info({ tickers: WATCHLIST.length }, "Rankings refresh started");
  let succeeded = 0;
  let failed = 0;

  const tickers = WATCHLIST.map((e) => e.ticker);
  for (let i = 0; i < tickers.length; i += SCORE_BATCH_SIZE) {
    const batch = tickers.slice(i, i + SCORE_BATCH_SIZE);
    await Promise.all(
      batch.map(async (ticker) => {
        try {
          await getScore(ticker);
          succeeded++;
        } catch (err) {
          if (err instanceof TickerNotFoundError) {
            // ticker delisted or not on Yahoo — skip silently
          } else {
            logger.warn({ err, ticker }, "Rankings: failed to score ticker");
          }
          failed++;
        }
      }),
    );
    if (i + SCORE_BATCH_SIZE < tickers.length) {
      await new Promise((r) => setTimeout(r, SCORE_BATCH_DELAY_MS));
    }
  }

  lastRefreshAt = new Date();
  isRefreshing = false;
  logger.info({ succeeded, failed }, "Rankings refresh complete");
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

  // Sort by score descending, assign rank
  const sorted = rows
    .sort((a, b) => b.overallScore - a.overallScore)
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

router.post("/rankings/refresh", async (_req, res): Promise<void> => {
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
