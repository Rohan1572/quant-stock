// Indicative NSE/BSE sector benchmark medians used as comparison points for
// valuation and profitability scoring (spec §3.1/§3.3). This is a static
// reference table, not a live peer-clustering computation — true
// sector-relative percentile ranking against a dynamically fetched peer set
// is deferred to v2 (spec §7, scikit-learn item). Values are broad,
// order-of-magnitude Indian-market benchmarks, not date-stamped consensus
// figures — "See the Details" labels them as sector benchmarks so users
// know they're indicative, not live peer medians.
export interface SectorBenchmark {
  peRatio: number;
  pbRatio: number;
  evEbitda: number;
  pegRatio: number;
  roe: number; // percent
  roa: number; // percent
  grossMargin: number; // percent
  operatingMargin: number; // percent
  netMargin: number; // percent
  debtToEquity: number;
}

export const DEFAULT_BENCHMARK: SectorBenchmark = {
  peRatio: 24,
  pbRatio: 3.2,
  evEbitda: 14,
  pegRatio: 1.5,
  roe: 14,
  roa: 6,
  grossMargin: 35,
  operatingMargin: 15,
  netMargin: 9,
  debtToEquity: 0.6,
};

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  Technology: {
    peRatio: 27,
    pbRatio: 8,
    evEbitda: 17,
    pegRatio: 1.8,
    roe: 26,
    roa: 16,
    grossMargin: 32,
    operatingMargin: 24,
    netMargin: 18,
    debtToEquity: 0.1,
  },
  "Financial Services": {
    peRatio: 18,
    pbRatio: 2.6,
    evEbitda: 12,
    pegRatio: 1.3,
    roe: 15,
    roa: 1.6,
    grossMargin: 80,
    operatingMargin: 40,
    netMargin: 22,
    debtToEquity: 3.5,
  },
  Energy: {
    peRatio: 12,
    pbRatio: 1.6,
    evEbitda: 8,
    pegRatio: 1.4,
    roe: 11,
    roa: 5,
    grossMargin: 22,
    operatingMargin: 12,
    netMargin: 7,
    debtToEquity: 0.7,
  },
  "Consumer Defensive": {
    peRatio: 42,
    pbRatio: 12,
    evEbitda: 26,
    pegRatio: 2.5,
    roe: 30,
    roa: 16,
    grossMargin: 50,
    operatingMargin: 20,
    netMargin: 14,
    debtToEquity: 0.2,
  },
  "Consumer Cyclical": {
    peRatio: 28,
    pbRatio: 5,
    evEbitda: 16,
    pegRatio: 1.9,
    roe: 17,
    roa: 6,
    grossMargin: 28,
    operatingMargin: 11,
    netMargin: 7,
    debtToEquity: 0.5,
  },
  Healthcare: {
    peRatio: 34,
    pbRatio: 6,
    evEbitda: 20,
    pegRatio: 1.9,
    roe: 17,
    roa: 11,
    grossMargin: 55,
    operatingMargin: 20,
    netMargin: 14,
    debtToEquity: 0.3,
  },
  "Basic Materials": {
    peRatio: 14,
    pbRatio: 2.4,
    evEbitda: 8,
    pegRatio: 1.2,
    roe: 13,
    roa: 6,
    grossMargin: 25,
    operatingMargin: 14,
    netMargin: 8,
    debtToEquity: 0.6,
  },
  Industrials: {
    peRatio: 32,
    pbRatio: 6.5,
    evEbitda: 20,
    pegRatio: 1.9,
    roe: 18,
    roa: 8,
    grossMargin: 26,
    operatingMargin: 13,
    netMargin: 8,
    debtToEquity: 0.5,
  },
  Utilities: {
    peRatio: 16,
    pbRatio: 2.2,
    evEbitda: 9,
    pegRatio: 1.6,
    roe: 13,
    roa: 5,
    grossMargin: 40,
    operatingMargin: 25,
    netMargin: 12,
    debtToEquity: 1.4,
  },
  "Communication Services": {
    peRatio: 30,
    pbRatio: 4,
    evEbitda: 10,
    pegRatio: 1.7,
    roe: 9,
    roa: 3,
    grossMargin: 45,
    operatingMargin: 18,
    netMargin: 5,
    debtToEquity: 1.1,
  },
  "Real Estate": {
    peRatio: 40,
    pbRatio: 4.5,
    evEbitda: 22,
    pegRatio: 2.1,
    roe: 11,
    roa: 4,
    grossMargin: 38,
    operatingMargin: 25,
    netMargin: 15,
    debtToEquity: 0.7,
  },
};

export function getSectorBenchmark(sector: string | null): SectorBenchmark {
  if (!sector) return DEFAULT_BENCHMARK;
  return SECTOR_BENCHMARKS[sector] ?? DEFAULT_BENCHMARK;
}
