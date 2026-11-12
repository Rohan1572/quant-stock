import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  fetchScoringInputs,
  TickerNotFoundError,
} from "../src/lib/quant/scoringInputs";
import type { DataProvider, StockProfile } from "../src/lib/quant/provider";
import { yahooQuoteSummary } from "../src/lib/quant/yahooClient";

const TEST_PROFILE: StockProfile = {
  ticker: "TEST.NS",
  companyName: "Test Company",
  sector: "Technology",
  industry: null,
  marketCap: null,
  currency: "INR",
  price: 42,
  changePercent: null,
};

function scoringProvider(
  getScoringData: DataProvider["getScoringData"],
  getPriceHistory: DataProvider["getPriceHistory"],
): Pick<DataProvider, "getScoringData" | "getPriceHistory"> {
  return { getScoringData, getPriceHistory };
}

describe("score input fetching", () => {
  it("starts scoring-data and price-history requests concurrently", async () => {
    const calls: string[] = [];
    const provider = scoringProvider(
      async () => {
        calls.push("scoring-data");
        return { profile: TEST_PROFILE, financialSnapshot: null };
      },
      async () => {
        calls.push("price-history");
        return [];
      },
    );

    const result = fetchScoringInputs(provider, "TEST.NS");
    assert.deepEqual(calls, ["scoring-data", "price-history"]);
    assert.equal((await result).profile, TEST_PROFILE);
  });

  it("reports a missing ticker even when its history request fails", async () => {
    const provider = scoringProvider(
      async () => ({ profile: null, financialSnapshot: null }),
      async () => {
        throw new Error("history unavailable");
      },
    );

    await assert.rejects(
      fetchScoringInputs(provider, "MISSING.NS"),
      TickerNotFoundError,
    );
  });

  it("propagates history failures for a valid ticker", async () => {
    const historyError = new Error("history unavailable");
    const provider = scoringProvider(
      async () => ({ profile: TEST_PROFILE, financialSnapshot: null }),
      async () => {
        throw historyError;
      },
    );

    await assert.rejects(
      fetchScoringInputs(provider, "TEST.NS"),
      historyError,
    );
  });
});

describe("Yahoo quote-summary request coalescing", () => {
  it("shares concurrent requests but does not cache completed responses", async () => {
    const originalFetch = globalThis.fetch;
    let quoteSummaryRequests = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        quoteSummaryRequests++;
        return Response.json({
          quoteSummary: { result: [{ price: { regularMarketPrice: 42 } }] },
        });
      }
      if (url.includes("/v1/test/getcrumb")) {
        return new Response("test-crumb");
      }
      return new Response("", { status: 200 });
    };

    try {
      const [first, second] = await Promise.all([
        yahooQuoteSummary("TEST.NS"),
        yahooQuoteSummary("test.ns"),
      ]);
      assert.deepEqual(first, second);
      assert.equal(quoteSummaryRequests, 1);

      await yahooQuoteSummary("TEST.NS");
      assert.equal(quoteSummaryRequests, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("clears failed in-flight requests so later calls can retry", async () => {
    const originalFetch = globalThis.fetch;
    let quoteSummaryRequests = 0;
    let shouldFail = true;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        quoteSummaryRequests++;
        if (shouldFail) return new Response("unavailable", { status: 503 });
        return Response.json({ quoteSummary: { result: [{ price: {} }] } });
      }
      if (url.includes("/v1/test/getcrumb")) {
        return new Response("test-crumb");
      }
      return new Response("", { status: 200 });
    };

    try {
      const [first, second] = await Promise.all([
        yahooQuoteSummary("RETRY.NS"),
        yahooQuoteSummary("retry.ns"),
      ]);
      assert.equal(first, null);
      assert.equal(second, null);
      assert.equal(quoteSummaryRequests, 1);

      shouldFail = false;
      assert.ok(await yahooQuoteSummary("RETRY.NS"));
      assert.equal(quoteSummaryRequests, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});