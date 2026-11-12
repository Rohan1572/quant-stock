import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TransientProviderError } from "../src/lib/quant/providerErrors";
import {
  hasCurrentScoringMethod,
  resolveScoreCache,
  shouldServeStaleScore,
} from "../src/lib/quant/scoreCachePolicy";

const CURRENT_ASSUMPTIONS = {
  discountRate: 0.1,
  discountRateType: "cost_of_equity",
};

describe("score cache policy", () => {
  it("only reuses current-format scores after transient provider failures", () => {
    assert.equal(
      shouldServeStaleScore(
        new TransientProviderError("upstream unavailable"),
        CURRENT_ASSUMPTIONS,
      ),
      true,
    );
    assert.equal(
      shouldServeStaleScore(new Error("scoring failure"), CURRENT_ASSUMPTIONS),
      false,
    );
    assert.equal(
      shouldServeStaleScore(
        new TransientProviderError("upstream unavailable"),
        { wacc: 0.1 },
      ),
      false,
    );
    assert.equal(
      shouldServeStaleScore(
        new TransientProviderError("upstream unavailable"),
        { discountRate: 0.1, discountRateType: "legacy_wacc" },
      ),
      false,
    );
  });

  it("does not treat incomplete assumptions as a current score cache", () => {
    assert.equal(hasCurrentScoringMethod(null), false);
    assert.equal(hasCurrentScoringMethod({ discountRate: 0.1 }), false);
    assert.equal(hasCurrentScoringMethod(CURRENT_ASSUMPTIONS), true);
  });

  it("uses a fresh current cache without recomputing or persisting", async () => {
    let computeCalls = 0;
    let persistCalls = 0;
    const result = await resolveScoreCache({
      cached: {
        value: "cached-score",
        computedAt: new Date(900),
        dcfAssumptions: CURRENT_ASSUMPTIONS,
      },
      now: 1_000,
      ttlMs: 200,
      compute: async () => {
        computeCalls++;
        return "fresh-score";
      },
      persist: async () => {
        persistCalls++;
      },
      mapCached: (cached) => cached,
    });

    assert.equal(result, "cached-score");
    assert.equal(computeCalls, 0);
    assert.equal(persistCalls, 0);
  });

  it("serves stale current scores only for transient provider errors", async () => {
    const staleCache = {
      value: "cached-score",
      computedAt: new Date(0),
      dcfAssumptions: CURRENT_ASSUMPTIONS,
    };
    const providerError = new TransientProviderError("upstream unavailable");
    let persistedScore: string | null = null;
    let loggedError: unknown;

    const result = await resolveScoreCache({
      cached: staleCache,
      now: 1_000,
      ttlMs: 100,
      compute: async () => {
        throw providerError;
      },
      persist: async (score) => {
        persistedScore = score;
      },
      mapCached: (cached) => cached,
      onStale: (error) => {
        loggedError = error;
      },
    });

    assert.equal(result, "cached-score");
    assert.equal(persistedScore, null);
    assert.equal(loggedError, providerError);

    const scoringError = new Error("invalid score input");
    await assert.rejects(
      resolveScoreCache({
        cached: staleCache,
        now: 1_000,
        ttlMs: 100,
        compute: async () => {
          throw scoringError;
        },
        persist: async () => {},
        mapCached: (cached) => cached,
      }),
      scoringError,
    );
  });

  it("recomputes legacy caches and propagates failures rather than serving them", async () => {
    const legacyCache = {
      value: "legacy-score",
      computedAt: new Date(999),
      dcfAssumptions: { wacc: 0.1 },
    };
    const providerError = new TransientProviderError("upstream unavailable");
    let computeCalls = 0;

    await assert.rejects(
      resolveScoreCache({
        cached: legacyCache,
        now: 1_000,
        ttlMs: 10_000,
        compute: async () => {
          computeCalls++;
          throw providerError;
        },
        persist: async () => {},
        mapCached: (cached) => cached,
      }),
      providerError,
    );
    assert.equal(computeCalls, 1);
  });

  it("persists successfully recomputed scores", async () => {
    let persistedScore: string | null = null;
    const result = await resolveScoreCache({
      cached: null,
      now: 1_000,
      ttlMs: 100,
      compute: async () => "fresh-score",
      persist: async (score) => {
        persistedScore = score;
      },
      mapCached: (cached) => cached,
    });

    assert.equal(result, "fresh-score");
    assert.equal(persistedScore, "fresh-score");
  });

  it("propagates persistence failures instead of returning a stale score", async () => {
    const persistenceError = new Error("database write failed");

    await assert.rejects(
      resolveScoreCache({
        cached: {
          value: "cached-score",
          computedAt: new Date(0),
          dcfAssumptions: CURRENT_ASSUMPTIONS,
        },
        now: 1_000,
        ttlMs: 100,
        compute: async () => "fresh-score",
        persist: async () => {
          throw persistenceError;
        },
        mapCached: (cached) => cached,
      }),
      persistenceError,
    );
  });
});
