import { Router, type IRouter } from "express";
import {
  SearchStocksQueryParams,
  SearchStocksResponse,
  GetStockParams,
  GetStockResponse,
  GetStockScoreParams,
  GetStockScoreResponse,
  GetStockScoreDetailsParams,
  GetStockScoreDetailsResponse,
  GetStockHistoryParams,
  GetStockHistoryResponse,
} from "@workspace/api-zod";
import {
  getScore,
  getProfile,
  searchTickers,
  getHistory,
  TickerNotFoundError,
} from "../lib/quant/engine";

const router: IRouter = Router();

router.get("/stocks/search", async (req, res): Promise<void> => {
  const parsed = SearchStocksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const results = await searchTickers(parsed.data.q);
  res.json(SearchStocksResponse.parse(results));
});

router.get("/stocks/:ticker", async (req, res): Promise<void> => {
  const params = GetStockParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const profile = await getProfile(params.data.ticker);
  if (!profile) {
    res.status(404).json({ error: `Ticker not found: ${params.data.ticker}` });
    return;
  }

  res.json(
    GetStockResponse.parse({ ...profile, lastUpdated: new Date().toISOString() }),
  );
});

router.get("/stocks/:ticker/score", async (req, res): Promise<void> => {
  const params = GetStockScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const score = await getScore(params.data.ticker);
    res.json(
      GetStockScoreResponse.parse({
        ticker: score.ticker,
        overallScore: score.overallScore,
        recommendation: score.recommendation,
        confidence: score.confidence,
        fairValueEstimate: score.fairValueEstimate,
        categoryScores: score.categoryScores,
        topFactors: score.topFactors,
        riskFlags: score.riskFlags,
        explanation: score.explanation,
        computedAt: score.computedAt.toISOString(),
      }),
    );
  } catch (err) {
    if (err instanceof TickerNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get(
  "/stocks/:ticker/score/details",
  async (req, res): Promise<void> => {
    const params = GetStockScoreDetailsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    try {
      const score = await getScore(params.data.ticker);
      res.json(
        GetStockScoreDetailsResponse.parse({
          ticker: score.ticker,
          overallScore: score.overallScore,
          recommendation: score.recommendation,
          confidence: score.confidence,
          fairValueEstimate: score.fairValueEstimate,
          categoryScores: score.categoryScores,
          categories: score.categories,
          topFactors: score.topFactors,
          riskFlags: score.riskFlags,
          explanation: score.explanation,
          dcfAssumptions: score.dcfAssumptions,
          computedAt: score.computedAt.toISOString(),
        }),
      );
    } catch (err) {
      if (err instanceof TickerNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.get(
  "/stocks/:ticker/history/:range",
  async (req, res): Promise<void> => {
    const params = GetStockHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const points = await getHistory(params.data.ticker, params.data.range);
    if (points.length === 0) {
      res
        .status(404)
        .json({ error: `No price history for ${params.data.ticker}` });
      return;
    }

    res.json(
      GetStockHistoryResponse.parse({
        ticker: params.data.ticker.toUpperCase(),
        range: params.data.range,
        points,
      }),
    );
  },
);

export default router;
