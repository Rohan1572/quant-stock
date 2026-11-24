import { getWatchlistEntry, WATCHLIST } from "./nifty100";
import { getUsWatchlistEntry, US_WATCHLIST } from "./usWatchlist";
import type { Market } from "./market";

export function getWatchlist(market: Market) {
  return market === "india" ? WATCHLIST : US_WATCHLIST;
}

export function getMarketWatchlistEntry(market: Market, ticker: string) {
  return market === "india"
    ? getWatchlistEntry(ticker)
    : getUsWatchlistEntry(ticker);
}
