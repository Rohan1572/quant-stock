import {
  yahooSearch,
  yahooChart,
  yahooQuoteSummary,
  raw,
  type YahooSearchQuote,
} from "./yahooClient";
import { defaultCurrency, type Market } from "./market";

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
  /** Adjusted close when the provider supplies one; otherwise the raw close. */
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
  getScoringData(ticker: string): Promise<{
    profile: StockProfile | null;
    financialSnapshot: FinancialSnapshot | null;
  }>;
  getPriceHistory(
    ticker: string,
    range: "1m" | "6m" | "1y" | "5y",
  ): Promise<PricePoint[]>;
}

function exchangeFromTicker(
  ticker: string,
  exchange?: string,
  exchangeDisplay?: string,
): string {
  if (ticker.endsWith(".NS")) return "NSE";
  if (ticker.endsWith(".BO")) return "BSE";
  const value = `${exchange ?? ""} ${exchangeDisplay ?? ""}`.toUpperCase();
  if (value.includes("NASDAQ") || /\b(NMS|NGM|NCM)\b/.test(value)) {
    return "NASDAQ";
  }
  if (value.includes("NYSE AMERICAN") || /\bASE\b/.test(value)) {
    return "AMEX";
  }
  if (value.includes("NYSE") || /\bNYQ\b/.test(value)) return "NYSE";
  return exchangeDisplay ?? exchange ?? "US";
}

function mapSearchQuote(q: YahooSearchQuote): StockSearchResult {
  return {
    ticker: q.symbol,
    companyName: q.longname ?? q.shortname ?? q.symbol,
    exchange: exchangeFromTicker(q.symbol, q.exchange, q.exchDisp),
  };
}

export class YahooFinanceAdapter implements DataProvider {
  constructor(private readonly market: Market = "india") {}

  async search(query: string): Promise<StockSearchResult[]> {
    const quotes = await yahooSearch(query);
    return quotes.filter((quote) => this.isInMarket(quote)).map(mapSearchQuote);
  }

  async getProfile(ticker: string): Promise<StockProfile | null> {
    const summary = await yahooQuoteSummary(ticker);
    return summary ? mapProfile(ticker, summary, this.market) : null;
  }

  async getFinancialSnapshot(
    ticker: string,
  ): Promise<FinancialSnapshot | null> {
    const summary = await yahooQuoteSummary(ticker);
    return summary ? mapFinancialSnapshot(summary) : null;
  }

  async getScoringData(ticker: string): Promise<{
    profile: StockProfile | null;
    financialSnapshot: FinancialSnapshot | null;
  }> {
    const summary = await yahooQuoteSummary(ticker);
    if (!summary) {
      return { profile: null, financialSnapshot: null };
    }

    return {
      profile: mapProfile(ticker, summary, this.market),
      financialSnapshot: mapFinancialSnapshot(summary),
    };
  }

  async getPriceHistory(
    ticker: string,
    range: "1m" | "6m" | "1y" | "5y",
  ): Promise<PricePoint[]> {
    return yahooChart(ticker, range);
  }

  private isInMarket(quote: YahooSearchQuote): boolean {
    if (this.market === "india") {
      return quote.symbol.endsWith(".NS") || quote.symbol.endsWith(".BO");
    }

    return ["NASDAQ", "NYSE", "AMEX"].includes(
      exchangeFromTicker(quote.symbol, quote.exchange, quote.exchDisp),
    );
  }
}

function mapProfile(
  ticker: string,
  summary: NonNullable<Awaited<ReturnType<typeof yahooQuoteSummary>>>,
  market: Market,
): StockProfile {
  const price = summary.price ?? {};
  const assetProfile = summary.assetProfile ?? {};

  return {
    ticker,
    companyName:
      (price["longName"] as string) ?? (price["shortName"] as string) ?? ticker,
    sector: (assetProfile["sector"] as string) ?? null,
    industry: (assetProfile["industry"] as string) ?? null,
    marketCap: raw(price["marketCap"]),
    currency: (price["currency"] as string) ?? defaultCurrency(market),
    price: raw(price["regularMarketPrice"]),
    changePercent: raw(price["regularMarketChangePercent"]),
  };
}

function mapFinancialSnapshot(
  summary: NonNullable<Awaited<ReturnType<typeof yahooQuoteSummary>>>,
): FinancialSnapshot {
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
