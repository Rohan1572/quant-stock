import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  fetchScoringInputs,
  TickerNotFoundError,
} from "../src/lib/quant/scoringInputs";
import { singleFlight } from "../src/lib/quant/singleFlight";
import type { DataProvider, StockProfile } from "../src/lib/quant/provider";
import {
  yahooChart,
  yahooQuoteSummary,
} from "../src/lib/quant/yahooClient";

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
  it("shares cold crumb refreshes across different tickers", async () => {
    const originalFetch = globalThis.fetch;
    let cookieRequests = 0;
    let crumbRequests = 0;
    let quoteSummaryRequests = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("fc.yahoo.com")) {
        cookieRequests++;
        return new Response("", { status: 200 });
      }
      if (url.includes("/v1/test/getcrumb")) {
        crumbRequests++;
        return new Response("test-crumb");
      }
      if (url.includes("/v10/finance/quoteSummary/")) {
        quoteSummaryRequests++;
        return Response.json({ quoteSummary: { result: [{ price: {} }] } });
      }
      return new Response("", { status: 200 });
    };

    try {
      await Promise.all([
        yahooQuoteSummary("FIRST.NS"),
        yahooQuoteSummary("SECOND.NS"),
      ]);
      assert.equal(cookieRequests, 1);
      assert.equal(crumbRequests, 1);
      assert.equal(quoteSummaryRequests, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("shares concurrent requests but does not cache completed responses", async () => {
    const originalFetch = globalThis.fetch;
    let quoteSummaryRequests = 0;
    let requestedModules: string | null = null;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        quoteSummaryRequests++;
        requestedModules = new URL(url).searchParams.get("modules");
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
      assert.equal(
        requestedModules,
        "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile",
      );

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

describe("Yahoo chart request coalescing", () => {
  it("shares concurrent history requests for the same ticker and range", async () => {
    const originalFetch = globalThis.fetch;
    let chartRequests = 0;
    globalThis.fetch = async (input) => {
      if (String(input).includes("/v8/finance/chart/")) {
        chartRequests++;
        return Response.json({
          chart: {
            result: [
              {
                timestamp: [1_762_992_000],
                indicators: { quote: [{ close: [42], volume: [100] }] },
              },
            ],
          },
        });
      }
      return new Response("", { status: 200 });
    };

    try {
      const [first, second] = await Promise.all([
        yahooChart("TEST.NS", "1y"),
        yahooChart("test.ns", "1y"),
      ]);
      assert.deepEqual(first, second);
      assert.equal(chartRequests, 1);

      await yahooChart("TEST.NS", "1y");
      assert.equal(chartRequests, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("single-flight request helper", () => {
  it("shares concurrent work and removes both successful and failed tasks", async () => {
    const requests = new Map<string, Promise<number>>();
    let calls = 0;
    const createRequest = async () => {
      calls++;
      return 42;
    };

    const [first, second] = await Promise.all([
      singleFlight(requests, "ticker", createRequest),
      singleFlight(requests, "ticker", createRequest),
    ]);
    assert.equal(first, 42);
    assert.equal(second, 42);
    assert.equal(calls, 1);
    assert.equal(requests.size, 0);

    const failure = new Error("request failed");
    await assert.rejects(
      singleFlight(requests, "ticker", async () => {
        throw failure;
      }),
      failure,
    );
    assert.equal(requests.size, 0);
    assert.equal(await singleFlight(requests, "ticker", async () => 7), 7);
  });
});