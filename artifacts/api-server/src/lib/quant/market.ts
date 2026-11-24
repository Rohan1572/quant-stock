export const MARKETS = ["india", "us"] as const;

export type Market = (typeof MARKETS)[number];

export function isMarket(value: unknown): value is Market {
  return value === "india" || value === "us";
}

export function marketFromValue(value: unknown): Market | null {
  if (value === undefined) return "india";
  return isMarket(value) ? value : null;
}

export function defaultCurrency(market: Market): string {
  return market === "india" ? "INR" : "USD";
}

export function marketLabel(market: Market): string {
  return market === "india" ? "India" : "US";
}
