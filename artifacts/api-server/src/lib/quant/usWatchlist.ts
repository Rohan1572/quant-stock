import type { WatchlistEntry } from "./nifty100";

const FINANCIAL_SERVICES = "Financial Services";
const TECHNOLOGY = "Technology";
const ENERGY = "Energy";
const INDUSTRIALS = "Industrials";
const CONSUMER_DEFENSIVE = "Consumer Defensive";
const CONSUMER_CYCLICAL = "Consumer Cyclical";
const HEALTHCARE = "Healthcare";
const COMMUNICATION_SERVICES = "Communication Services";

// Curated, liquid US large-cap sample. This is not intended to represent the
// full US market or an index constituent list.
export const US_WATCHLIST: WatchlistEntry[] = [
  { ticker: "AAPL", companyName: "Apple", sector: TECHNOLOGY },
  { ticker: "MSFT", companyName: "Microsoft", sector: TECHNOLOGY },
  { ticker: "NVDA", companyName: "NVIDIA", sector: TECHNOLOGY },
  { ticker: "AVGO", companyName: "Broadcom", sector: TECHNOLOGY },
  { ticker: "ORCL", companyName: "Oracle", sector: TECHNOLOGY },
  { ticker: "CRM", companyName: "Salesforce", sector: TECHNOLOGY },
  { ticker: "AMZN", companyName: "Amazon", sector: CONSUMER_CYCLICAL },
  { ticker: "TSLA", companyName: "Tesla", sector: CONSUMER_CYCLICAL },
  { ticker: "COST", companyName: "Costco", sector: CONSUMER_DEFENSIVE },
  { ticker: "WMT", companyName: "Walmart", sector: CONSUMER_DEFENSIVE },
  { ticker: "PG", companyName: "Procter & Gamble", sector: CONSUMER_DEFENSIVE },
  { ticker: "KO", companyName: "Coca-Cola", sector: CONSUMER_DEFENSIVE },
  { ticker: "LLY", companyName: "Eli Lilly", sector: HEALTHCARE },
  { ticker: "JNJ", companyName: "Johnson & Johnson", sector: HEALTHCARE },
  { ticker: "UNH", companyName: "UnitedHealth Group", sector: HEALTHCARE },
  { ticker: "JPM", companyName: "JPMorgan Chase", sector: FINANCIAL_SERVICES },
  { ticker: "V", companyName: "Visa", sector: FINANCIAL_SERVICES },
  { ticker: "MA", companyName: "Mastercard", sector: FINANCIAL_SERVICES },
  { ticker: "XOM", companyName: "Exxon Mobil", sector: ENERGY },
  { ticker: "CVX", companyName: "Chevron", sector: ENERGY },
  { ticker: "CAT", companyName: "Caterpillar", sector: INDUSTRIALS },
  { ticker: "GE", companyName: "GE Aerospace", sector: INDUSTRIALS },
  {
    ticker: "GOOGL",
    companyName: "Alphabet",
    sector: COMMUNICATION_SERVICES,
  },
  {
    ticker: "META",
    companyName: "Meta Platforms",
    sector: COMMUNICATION_SERVICES,
  },
  { ticker: "NFLX", companyName: "Netflix", sector: COMMUNICATION_SERVICES },
];

export function getUsWatchlistEntry(
  ticker: string,
): WatchlistEntry | undefined {
  return US_WATCHLIST.find((entry) => entry.ticker === ticker.toUpperCase());
}
