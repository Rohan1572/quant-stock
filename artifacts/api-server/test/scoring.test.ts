import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeCategories,
  computeConfidence,
  confidenceLevel,
  estimateFairValue,
  getDcfAssumptions,
  recommendationFromScore,
  scoreFinancialHealth,
  scoreMomentum,
  scoreRisk,
  scoreValuation,
  shrinkToConfidence,
} from "../src/lib/quant/scoring";
import { getSectorBenchmark } from "../src/lib/quant/sectorBenchmarks";
import {
  coverage,
  diversity,
  linearScore,
  logRatioScore,
  maxDrawdown,
  realisedVolatility,
  weightedMean,
} from "../src/lib/quant/statistics";
import type {
  FinancialSnapshot,
  PricePoint,
  StockProfile,
} from "../src/lib/quant/provider";

// Every field explicit, so the suite still compiles if the type grows one.
function snapshot(
  overrides: Partial<FinancialSnapshot> = {},
): FinancialSnapshot {
  return {
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
    ...overrides,
  };
}

function profile(price: number | null): StockProfile {
  return {
    ticker: "TEST.NS",
    companyName: "Test Co",
    sector: "Technology",
    industry: null,
    marketCap: 1e12,
    currency: "INR",
    price,
    changePercent: 0,
  };
}

/** Price history ending today, so recency-based quality checks pass. */
function history(closes: number[]): PricePoint[] {
  const today = Date.now();
  return closes.map((close, i) => ({
    date: new Date(today - (closes.length - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    close,
    volume: 1e6,
  }));
}

const RISING = history(Array.from({ length: 250 }, (_, i) => 100 + i * 0.4));
const TECH = getSectorBenchmark("Technology");

const DEFAULT_WEIGHTS = {
  valuationWeight: 0.25,
  financialHealthWeight: 0.2,
  profitabilityWeight: 0.2,
  growthWeight: 0.15,
  riskWeight: 0.1,
  momentumWeight: 0.1,
};

const FULL = {
  peRatio: 20,
  pbRatio: 3,
  evEbitda: 12,
  pegRatio: 1.2,
  roe: 18,
  roa: 8,
  grossMargin: 40,
  operatingMargin: 18,
  netMargin: 11,
  debtToEquity: 0.5,
  currentRatio: 1.6,
  quickRatio: 1.1,
  revenueGrowth: 12,
  earningsGrowth: 15,
  freeCashflow: 5e9,
  beta: 1.1,
  fiftyDayAverage: 100,
  twoHundredDayAverage: 100,
  fiftyTwoWeekHigh: 120,
  totalRevenue: 1e11,
};

describe("ratio scoring is symmetric (regression)", () => {
  it("mirrors an equal premium and discount around the benchmark", () => {
    const double = logRatioScore(48, 24, 0.45, false);
    const half = logRatioScore(12, 24, 0.45, false);
    assert.ok(
      Math.abs(double - 50 + (half - 50)) < 1e-9,
      `expected mirrored deviations, got ${double} and ${half}`,
    );
  });

  it("saturates without pinning to 0 or 100", () => {
    const double = logRatioScore(48, 24, 0.45, false);
    const half = logRatioScore(12, 24, 0.45, false);
    assert.ok(
      double > 5 && double < 50,
      `2x premium scores low but not 0: ${double}`,
    );
    assert.ok(
      half < 95 && half > 50,
      `0.5x discount scores high but not 100: ${half}`,
    );
  });

  it("scores the benchmark itself as neutral", () => {
    assert.equal(logRatioScore(24, 24, 0.45, false), 50);
    assert.equal(linearScore(14, 14, 8, true), 50);
  });

  it("rejects non-positive and NaN ratios as invalid, not merely neutral", () => {
    for (const bad of [0, -10, Number.NaN]) {
      assert.ok(
        Number.isNaN(logRatioScore(bad, 24, 0.45, false)),
        `expected ${bad} to be marked invalid`,
      );
    }
  });

  it("treats a non-finite value as missing data, not a neutral opinion", () => {
    // Infinity is a sentinel; counting it as 50 would dilute the average.
    for (const sentinel of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      assert.ok(
        Number.isNaN(logRatioScore(sentinel, 24, 0.45, false)),
        `expected ${sentinel} to be excluded`,
      );
      assert.ok(Number.isNaN(linearScore(sentinel, 14, 8, true)));
    }
  });

  it("accepts negative levels, which are legitimate for drawdown and growth", () => {
    assert.ok(Number.isFinite(linearScore(-35, -30, 18, true)));
    assert.ok(Number.isFinite(linearScore(-12, 8, 12, true)));
  });
});

describe("valuation scoring (regression)", () => {
  // A negative P/E used to clamp to a perfect 100, beating the whole sector.
  it("does not reward a loss-making company with a perfect valuation score", () => {
    const loss = scoreValuation(
      snapshot({
        peRatio: -50,
        pbRatio: 2,
        evEbitda: 8,
        pegRatio: -2,
        netIncome: -5000,
      }),
      TECH,
    );
    const healthy = scoreValuation(
      snapshot({ peRatio: 12, pbRatio: 3, evEbitda: 9, pegRatio: 0.9 }),
      TECH,
    );
    assert.ok(
      loss.score < healthy.score,
      `loss-maker (${loss.score}) must not outscore a healthy company (${healthy.score})`,
    );
  });

  it("marks a negative P/E as present but not meaningful", () => {
    const loss = scoreValuation(snapshot({ peRatio: -50, pbRatio: 2 }), TECH);
    const pe = loss.metrics.find((m) => m.key === "peRatio");
    assert.ok(pe);
    assert.equal(pe.available, true, "the value exists");
    assert.equal(
      pe.meaningful,
      false,
      "but it carries no valuation information",
    );
  });

  it("reports coverage that reflects an excluded metric", () => {
    const loss = scoreValuation(
      snapshot({ peRatio: -50, pbRatio: 2, evEbitda: 8 }),
      TECH,
    );
    assert.ok(loss.coverage < 1 && loss.coverage > 0);
  });
});

describe("momentum scoring (regression)", () => {
  // Both moving-average metrics were passed a benchmark of 0, which the old
  // transform short-circuited to a flat 50 for every price deviation.
  const MA_FIN = snapshot({
    fiftyDayAverage: 100,
    twoHundredDayAverage: 100,
    fiftyTwoWeekHigh: 150,
  });

  it("scores price above and below the 50-day average differently", () => {
    const above = scoreMomentum(profile(150), MA_FIN, RISING);
    const below = scoreMomentum(profile(50), MA_FIN, RISING);
    const up = above.metrics.find((m) => m.key === "vs50DayAvg")?.score;
    const down = below.metrics.find((m) => m.key === "vs50DayAvg")?.score;
    assert.ok(up !== undefined && down !== undefined);
    assert.ok(
      Math.abs(up - 50) > 10 && Math.abs(down - 50) > 10,
      `both moved off neutral, got ${up} and ${down}`,
    );
    assert.ok(up > 50 && down < 50, "direction is correct");
  });

  it("scores the 200-day average rather than defaulting it to neutral", () => {
    const metric = scoreMomentum(profile(150), MA_FIN, RISING).metrics.find(
      (m) => m.key === "vs200DayAvg",
    );
    assert.ok(metric);
    assert.ok(Math.abs(metric.score - 50) > 10, "not the old dead constant");
  });
});

describe("aggregation treats missing data honestly", () => {
  it("does not let absent metrics inject a neutral 50 into the average", () => {
    const partial = scoreValuation(snapshot({ peRatio: 8, pbRatio: 2 }), TECH);
    const withNeutrals = scoreValuation(
      snapshot({ peRatio: 8, pbRatio: 2, evEbitda: 27, pegRatio: 1.8 }),
      TECH,
    );
    // evEbitda and PEG sit on their sector benchmarks, so they score a neutral
    // 50 each. Compare direction only: the coverage shrink still applies.
    assert.ok(
      withNeutrals.score < partial.score,
      "adding on-benchmark metrics at 50 must not raise the score",
    );
    assert.ok(
      partial.score > 60,
      `strong metrics should still read strong, got ${partial.score}`,
    );
  });

  describe("confidence measures the metrics scoring actually uses", () => {
    it("is not inflated by fields that do not feed scoring", () => {
      const unusedOnly = computeConfidence(
        snapshot({
          forwardPe: 20,
          fiftyTwoWeekLow: 50,
          operatingCashflow: 1e9,
          ebitda: 1e9,
          totalRevenue: 1e11,
          netIncome: 1e10,
        }),
        RISING,
        [],
        "Technology",
      );
      const full = computeConfidence(snapshot(FULL), RISING, [], "Technology");
      assert.ok(
        unusedOnly.score < full.score,
        `unused only (${unusedOnly.score}) must not outrank full data (${full.score})`,
      );
      assert.ok(
        unusedOnly.score < 35,
        "no scoring-relevant data means low confidence",
      );
    });

    it("penalises a fallback benchmark over a sector-specific one", () => {
      const fin = snapshot({ peRatio: 20, pbRatio: 3, roe: 18 });
      const withSector = computeConfidence(fin, RISING, [], "Technology");
      const withoutSector = computeConfidence(fin, RISING, [], null);
      assert.ok(withSector.score > withoutSector.score);
      assert.ok(withSector.breakdown.benchmarkQuality > 0.8);
      assert.ok(withSector.breakdown.benchmarkQuality < 1);
      assert.ok(withoutSector.breakdown.benchmarkQuality < 1);
    });

    it("stays within 0-100 and exposes its components", () => {
      const { score, breakdown } = computeConfidence(
        snapshot({ peRatio: 20, pbRatio: 3, roe: 18 }),
        RISING,
        [],
        "Technology",
      );
      assert.ok(score >= 0 && score <= 100);
      for (const value of Object.values(breakdown)) {
        assert.ok(value >= 0 && value <= 1, `component out of range: ${value}`);
      }
    });

    it("drops when the price history is too short to be meaningful", () => {
      const fin = snapshot({ peRatio: 20, pbRatio: 3, roe: 18 });
      const plenty = computeConfidence(fin, RISING, [], "Technology");
      const sparse = computeConfidence(
        fin,
        history([100, 101, 102]),
        [],
        "Technology",
      );
      assert.ok(sparse.score < plenty.score);
    });
  });

  describe("confidence shrinkage (regression)", () => {
    // The raw score used to map straight to a recommendation.
    it("prevents a low-confidence high score from becoming a buy call", () => {
      const adjusted = shrinkToConfidence(90, 10);
      assert.equal(recommendationFromScore(adjusted), "hold");
      assert.ok(
        adjusted < 60,
        `expected shrinkage toward neutral, got ${adjusted}`,
      );
    });

    it("preserves the signal when confidence is high", () => {
      assert.equal(
        recommendationFromScore(shrinkToConfidence(90, 95)),
        "strong_buy",
      );
    });

    it("collapses to neutral at zero confidence", () => {
      assert.equal(shrinkToConfidence(95, 0), 50);
      assert.equal(shrinkToConfidence(5, 0), 50);
      assert.equal(recommendationFromScore(50), "hold");
    });

    it("is monotonic in confidence", () => {
      const scores = [0, 25, 50, 75, 100].map((c) => shrinkToConfidence(80, c));
      for (let i = 1; i < scores.length; i++) {
        assert.ok(
          scores[i] > scores[i - 1],
          "more confidence pulls further from neutral",
        );
      }
    });
  });

  describe("uncertainty is reported rather than implied", () => {
    it("produces a non-zero-width band containing the point estimate", () => {
      const result = computeCategories(
        profile(120),
        snapshot(FULL),
        DEFAULT_WEIGHTS,
        RISING,
      );
      assert.ok(
        result.scoreRange.high > result.scoreRange.low,
        "band has real width",
      );
      assert.ok(
        result.scoreRange.low <= result.overallScore &&
          result.overallScore <= result.scoreRange.high,
        "point estimate sits inside its own interval",
      );
      assert.ok(result.coverage > 0 && result.coverage <= 1);
    });
  });

  describe("DCF discounting (regression)", () => {
    const cashflows = {
      freeCashflow: 1e10,
      sharesOutstanding: 1e9,
      totalDebt: 1e9,
      totalCash: 1e9,
    };
    const dcf = (beta: number, growth = 10) =>
      getDcfAssumptions({ ...snapshot(), ...cashflows, beta }, growth);

    it("adjusts implausibly low published betas toward the market", () => {
      // Yahoo reports betas of ~0.11-0.40 for Indian NSE large caps, which put
      // WACC near the risk-free rate and overstated fair value.
      const low = dcf(0.15);
      assert.ok(
        low.beta > 0.6,
        `Blume adjustment should lift a 0.15 beta, got ${low.beta}`,
      );
    });

    it("never discounts below the risk-free rate", () => {
      const zero = dcf(0.001);
      assert.ok(
        zero.wacc > zero.riskFreeRate,
        `WACC ${zero.wacc} must exceed risk-free ${zero.riskFreeRate}`,
      );
    });

    it("keeps a safe spread over terminal growth at every beta", () => {
      for (const beta of [0.1, 0.5, 1, 1.5, 2.5]) {
        const a = dcf(beta);
        assert.ok(
          a.wacc > a.terminalGrowthRate + 0.02,
          `beta ${beta}: spread too thin for the Gordon model`,
        );
      }
    });

    it("raises the discount rate as risk rises", () => {
      assert.ok(dcf(1.8).wacc > dcf(0.6).wacc);
    });

    it("returns null rather than a number without usable cash flow", () => {
      assert.equal(estimateFairValue(snapshot(), 10), null);
      assert.equal(
        estimateFairValue(
          { ...snapshot(), ...cashflows, freeCashflow: -1 },
          10,
        ),
        null,
        "negative free cash flow has no Gordon value",
      );
    });

    it("values a lower-risk company higher at the same cash flow", () => {
      const lowRisk = estimateFairValue(
        { ...snapshot(), ...cashflows, beta: 0.3 },
        10,
      );
      const highRisk = estimateFairValue(
        { ...snapshot(), ...cashflows, beta: 2 },
        10,
      );
      assert.ok(lowRisk !== null && highRisk !== null);
      assert.ok(lowRisk > highRisk, "less risk means more present value");
    });
  });

  describe("risk metrics come from the real price series", () => {
    it("penalises a crashing stock more than a calm one", () => {
      const calm = history(
        Array.from({ length: 250 }, (_, i) => 100 + Math.sin(i / 5) * 3),
      );
      const crash = history(
        Array.from({ length: 250 }, (_, i) =>
          i < 120 ? 100 : 100 * (1 - (i - 120) / 60),
        ),
      );
      const fin = snapshot({ beta: 1, debtToEquity: 0.5 });
      assert.ok(
        scoreRisk(fin, TECH, crash).score < scoreRisk(fin, TECH, calm).score,
      );
    });

    it("treats an implausible beta as invalid rather than as an extreme score", () => {
      for (const bad of [0, -1, 5]) {
        const metric = scoreRisk(
          snapshot({ beta: bad, debtToEquity: 0.5 }),
          TECH,
          RISING,
        ).metrics.find((m) => m.key === "beta");
        assert.ok(metric);
        assert.equal(metric.available, false, `beta ${bad} should be rejected`);
      }
    });

    it("computes volatility and drawdown with the expected sign", () => {
      const noisy = realisedVolatility(
        Array.from({ length: 30 }, (_, i) => 100 * (1 + Math.sin(i / 2) * 0.1)),
      );
      assert.ok(
        noisy !== null && noisy >= 0,
        "annualised volatility is a positive percent",
      );
      assert.equal(
        realisedVolatility([100, 101, 102]),
        null,
        "too short to estimate",
      );

      const dd = maxDrawdown([100, 120, 60, 80, 90, 110, 70, 95, 105, 85]);
      assert.ok(
        dd !== null && dd < 0,
        `drawdown is a negative percent, got ${dd}`,
      );
      assert.equal(maxDrawdown([100, 101, 102]), null, "too short to estimate");
    });
  });

  describe("aggregation primitives", () => {
    it("excludes non-finite scores from the mean and from coverage", () => {
      const items = [
        { score: 80, weight: 1 },
        { score: Number.NaN, weight: 1 },
      ];
      assert.equal(
        weightedMean(items),
        80,
        "renormalises over the available metric",
      );
      assert.equal(coverage(items), 0.5);
    });

    it("reports zero coverage and neutral when nothing is available", () => {
      assert.equal(coverage([{ score: Number.NaN, weight: 1 }]), 0);
      assert.equal(weightedMean([{ score: Number.NaN, weight: 1 }]), 50);
    });

    it("scores an independent metric set above a concentrated one", () => {
      const balanced = diversity([
        { score: 70, weight: 1 },
        { score: 70, weight: 1 },
        { score: 70, weight: 1 },
      ]);
      const concentrated = diversity([
        { score: 70, weight: 10 },
        { score: 70, weight: 1 },
        { score: 70, weight: 1 },
      ]);
      assert.ok(
        balanced > concentrated,
        "correlated metrics add less information",
      );
    });
  });

  describe("confidence levels", () => {
    it("maps scores onto qualitative bands", () => {
      assert.equal(confidenceLevel(90), "high");
      assert.equal(confidenceLevel(60), "moderate");
      assert.equal(confidenceLevel(20), "low");
    });
  });

  describe("financial health uses scale-free cash metrics", () => {
    it("scores FCF margin and yield rather than absolute FCF", () => {
      const keys = scoreFinancialHealth(
        snapshot({
          freeCashflow: 5e9,
          totalRevenue: 1e11,
          debtToEquity: 0.5,
          currentRatio: 1.6,
          quickRatio: 1.1,
        }),
        profile(100),
      ).metrics.map((m) => m.key);
      assert.ok(keys.includes("fcfMargin"));
      assert.ok(keys.includes("fcfYield"));
      assert.ok(
        !keys.includes("freeCashflow"),
        "absolute FCF is no longer a metric",
      );
    });

    it("treats identical FCF differently at different company sizes", () => {
      const marginOf = (revenue: number) =>
        scoreFinancialHealth(
          snapshot({ freeCashflow: 1e8, totalRevenue: revenue }),
          profile(100),
        ).metrics.find((m) => m.key === "fcfMargin")?.score;
      assert.notEqual(marginOf(1e9), marginOf(1e11));
    });
  });
  it("produces a non-zero-width band containing the point estimate", () => {
    const result = computeCategories(
      profile(120),
      snapshot(FULL),
      DEFAULT_WEIGHTS,
      RISING,
    );
    assert.ok(
      result.scoreRange.high > result.scoreRange.low,
      "band has real width",
    );
    assert.ok(
      result.scoreRange.low <= result.overallScore &&
        result.overallScore <= result.scoreRange.high,
      "point estimate sits inside its own interval",
    );
    assert.ok(result.coverage > 0 && result.coverage <= 1);
  });
});
it("shrinks a thinly-covered category toward neutral", () => {
  // Without the shrink, a loss-maker left with P/B and EV/EBITDA reads as
  // stellar purely because P/E and PEG were dropped.
  const thin = scoreValuation(
    snapshot({ peRatio: -50, pbRatio: 2, evEbitda: 8, pegRatio: -2 }),
    TECH,
  );
  assert.ok(
    thin.score < 85,
    `thin coverage must not read as stellar, got ${thin.score}`,
  );
});

it("reports coverage between 0 and 1", () => {
  assert.equal(scoreValuation(snapshot(), TECH).coverage, 0);
  assert.equal(
    scoreValuation(
      snapshot({ peRatio: 10, pbRatio: 3, evEbitda: 12, pegRatio: 1 }),
      TECH,
    ).coverage,
    1,
  );
});
