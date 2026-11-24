import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMarket, type Market } from "@/contexts/MarketContext";

export function MarketToggle({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  const { market, setMarket } = useMarket();
  const [location, setLocation] = useLocation();

  function selectMarket(next: Market) {
    setMarket(next);
    if (location.startsWith("/stocks/")) {
      const ticker = location.slice("/stocks/".length).split("?")[0];
      setLocation(`/stocks/${ticker}?market=${next}`);
    }
  }

  return (
    <fieldset className="inline-flex min-w-0 items-center gap-0.5 rounded-lg border bg-card p-0.5">
      <legend className="sr-only">Select market</legend>
      {(["india", "us"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={market === value}
          onClick={() => selectMarket(value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            compact ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
            market === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === "india" ? "India" : "US"}
        </button>
      ))}
    </fieldset>
  );
}
