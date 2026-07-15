import {
  yahooSearch,
  yahooChart,
  yahooQuoteSummary,
  raw,
  type YahooSearchQuote,
} from "./yahooClient";

export interface StockSearchResult {
  ticker: string;
  companyName: string;
  exchange: string;
}

export interface StockProfile {
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  currency: string;
  price: number | null;
  changePercent: number | null;
}

export interface FinancialSnapshot {
  peRatio: number | null;
  forwardPe: number | null;
  pbRatio: number | null;
  evEbitda: number | null;
  pegRatio: number | null;
  roe: number | null;
  roa: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  beta: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  sharesOutstanding: number | null;
  ebitda: number | null;
  totalRevenue: number | null;
  netIncome: number | null;
}

export interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

// A DataProvider abstracts the upstream market-data source so the scoring
// engine never talks to Yahoo Finance directly. Swapping in a licensed
// provider later means implementing this interface again — nothing else
// changes.
export interface DataProvider {
  search(query: string): Promise<StockSearchResult[]>;
  getProfile(ticker: string): Promise<StockProfile | null>;
  getFinancialSnapshot(ticker: string): Promise<FinancialSnapshot | null>;
  getPriceHistory(
    ticker: string,
    range: "1m" | "6m" | "1y" | "5y",
  ): Promise<PricePoint[]>;
}

function exchangeFromTicker(ticker: string): string {
  if (ticker.endsWith(".NS")) return "NSE";
  if (ticker.endsWith(".BO")) return "BSE";
  return "NSE";
}

function mapSearchQuote(q: YahooSearchQuote): StockSearchResult {
  return {
    ticker: q.symbol,
    companyName: q.longname ?? q.shortname ?? q.symbol,
    exchange: exchangeFromTicker(q.symbol),
  };
}

export class YahooFinanceAdapter implements DataProvider {
  async search(query: string): Promise<StockSearchResult[]> {
    const quotes = await yahooSearch(query);
    // Prefer NSE/BSE listings (India-only scope for v1).
    return quotes
      .filter((q) => q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO"))
      .map(mapSearchQuote);
  }

  async getProfile(ticker: string): Promise<StockProfile | null> {
    const summary = await yahooQuoteSummary(ticker);
    if (!summary) return null;

    const price = summary.price ?? {};
    const assetProfile = summary.assetProfile ?? {};

    return {
      ticker,
      companyName:
        (price["longName"] as string) ??
        (price["shortName"] as string) ??
        ticker,
      sector: (assetProfile["sector"] as string) ?? null,
      industry: (assetProfile["industry"] as string) ?? null,
      marketCap: raw(price["marketCap"]),
      currency: (price["currency"] as string) ?? "INR",
      price: raw(price["regularMarketPrice"]),
      changePercent: raw(price["regularMarketChangePercent"]),
    };
  }

  async getFinancialSnapshot(
    ticker: string,
  ): Promise<FinancialSnapshot | null> {
    const summary = await yahooQuoteSummary(ticker);
    if (!summary) return null;

    const summaryDetail = summary.summaryDetail ?? {};
    const keyStats = summary.defaultKeyStatistics ?? {};
    const financialData = summary.financialData ?? {};

    return {
      peRatio: raw(summaryDetail["trailingPE"]),
      forwardPe: raw(summaryDetail["forwardPE"]),
      pbRatio: raw(keyStats["priceToBook"]),
      evEbitda: raw(keyStats["enterpriseToEbitda"]),
      pegRatio: raw(keyStats["pegRatio"]),
      roe: toPercent(raw(financialData["returnOnEquity"])),
      roa: toPercent(raw(financialData["returnOnAssets"])),
      grossMargin: toPercent(raw(financialData["grossMargins"])),
      operatingMargin: toPercent(raw(financialData["operatingMargins"])),
      netMargin: toPercent(raw(financialData["profitMargins"])),
      debtToEquity: normalizeDebtToEquity(raw(financialData["debtToEquity"])),
      currentRatio: raw(financialData["currentRatio"]),
      quickRatio: raw(financialData["quickRatio"]),
      revenueGrowth: toPercent(raw(financialData["revenueGrowth"])),
      earningsGrowth: toPercent(raw(financialData["earningsGrowth"])),
      freeCashflow: raw(financialData["freeCashflow"]),
      operatingCashflow: raw(financialData["operatingCashflow"]),
      totalCash: raw(financialData["totalCash"]),
      totalDebt: raw(financialData["totalDebt"]),
      beta: raw(summaryDetail["beta"]),
      fiftyDayAverage: raw(summaryDetail["fiftyDayAverage"]),
      twoHundredDayAverage: raw(summaryDetail["twoHundredDayAverage"]),
      fiftyTwoWeekHigh: raw(summaryDetail["fiftyTwoWeekHigh"]),
      fiftyTwoWeekLow: raw(summaryDetail["fiftyTwoWeekLow"]),
      sharesOutstanding: raw(keyStats["sharesOutstanding"]),
      ebitda: raw(financialData["ebitda"]),
      totalRevenue: raw(financialData["totalRevenue"]),
      netIncome: raw(keyStats["netIncomeToCommon"]),
    };
  }

  async getPriceHistory(
    ticker: string,
    range: "1m" | "6m" | "1y" | "5y",
  ): Promise<PricePoint[]> {
    return yahooChart(ticker, range);
  }
}

// Yahoo returns ratios like ROE/margins as fractions (0.18 = 18%); some
// debtToEquity values come back already multiplied by 100 depending on
// the module. Normalize to a plain percent number for the scoring engine.
function toPercent(fraction: number | null): number | null {
  if (fraction == null) return null;
  return fraction * 100;
}

function normalizeDebtToEquity(value: number | null): number | null {
  if (value == null) return null;
  // Yahoo's financialData.debtToEquity is typically already a percent
  // (e.g. 45.2 meaning 0.452 debt-to-equity ratio); convert to a plain ratio.
  return value / 100;
}
