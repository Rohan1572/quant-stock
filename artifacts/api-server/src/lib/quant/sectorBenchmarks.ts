// Indicative NSE/BSE sector benchmark medians (spec §3.1/§3.3). Static
// reference values, not live peer medians — sector-relative percentile ranking
// is deferred to v2 (spec §7).
//
// Scoring also needs each metric's *dispersion*: a raw gap to the median means
// nothing without knowing how spread out sector peers are.
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

/**
 * One standard deviation per metric, used to turn the gap to a sector median
 * into a z-score. Deliberately generous: understating sigma makes ordinary
 * variation look like a strong signal. A log sigma of 0.45 means the sector
 * multiple typically varies by a factor of ~1.57x between peers.
 */
export interface MetricDispersion {
  /** Log-space sigma for multiplicative valuation multiples. */
  logMultiple: number;
  /** Sigma in percentage points for margin/return metrics. */
  percentPoints: number;
  /** Sigma in raw ratio units for balance-sheet ratio metrics. */
  ratio: number;
}

export const DISPERSION: MetricDispersion = {
  logMultiple: 0.45,
  percentPoints: 8,
  ratio: 0.6,
};

// Market-wide (not sector-relative) dispersions for categories where a sector
// median is not the right reference point.
export const GROWTH_DISPERSION = 12; // percentage points
export const MOMENTUM_DISPERSION = 18; // percentage points
export const RISK_DISPERSION = 0.45; // beta units
export const VOLATILITY_DISPERSION = 15; // percentage points, annualised
export const DRAWDOWN_DISPERSION = 18; // percentage points
export const LIQUIDITY_DISPERSION = 0.5; // current/quick ratio units

// Yahoo sometimes returns sectors with different casing or trailing
// qualifiers; normalising avoids falling back for a sector we do have.
function normaliseSector(sector: string): string {
  return sector.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Sector keys in the table, pre-normalised for case/whitespace-insensitive lookup. */
const NORMALISED_BENCHMARKS: Map<string, SectorBenchmark> = new Map(
  Object.entries(SECTOR_BENCHMARKS).map(([key, value]) => [
    normaliseSector(key),
    value,
  ]),
);

export function getSectorBenchmark(sector: string | null): SectorBenchmark {
  if (!sector) return DEFAULT_BENCHMARK;
  return (
    NORMALISED_BENCHMARKS.get(normaliseSector(sector)) ?? DEFAULT_BENCHMARK
  );
}

/**
 * Whether a real sector benchmark was found, as opposed to the fallback —
 * scored against the wrong reference distribution deserves lower confidence.
 */
export function hasSectorBenchmark(sector: string | null): boolean {
  if (!sector) return false;
  return NORMALISED_BENCHMARKS.has(normaliseSector(sector));
}
