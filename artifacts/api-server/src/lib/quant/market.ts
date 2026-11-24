const MARKETS = ["india", "us"] as const;

export type Market = (typeof MARKETS)[number];

function isMarket(value: unknown): value is Market {
  return (
    typeof value === "string" && (MARKETS as readonly string[]).includes(value)
  );
}

export function marketFromValue(value: unknown): Market | null {
  if (value === undefined) return "india";
  return isMarket(value) ? value : null;
}

export function defaultCurrency(market: Market): string {
  return market === "india" ? "INR" : "USD";
}
