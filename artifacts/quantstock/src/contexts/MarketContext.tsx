import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Market = "india" | "us";

interface MarketContextValue {
  market: Market;
  setMarket: (market: Market) => void;
}

const STORAGE_KEY = "qs_market";
const MarketContext = createContext<MarketContextValue | null>(null);

function isMarket(value: string | null): value is Market {
  return value === "india" || value === "us";
}

function getInitialMarket(): Market {
  const queryMarket = new URLSearchParams(window.location.search).get("market");
  if (isMarket(queryMarket)) return queryMarket;

  const ticker = decodeURIComponent(
    window.location.pathname.split("/").pop() ?? "",
  ).toUpperCase();
  if (ticker.endsWith(".NS") || ticker.endsWith(".BO")) return "india";

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isMarket(stored)) return stored;
  } catch {
    // Market selection still works for the current page when storage is blocked.
  }
  return "india";
}

export function MarketProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [market, setMarket] = useState<Market>(getInitialMarket);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, market);
    } catch {
      // Persistence is best-effort; the selected market remains active.
    }
  }, [market]);

  const value = useMemo(() => ({ market, setMarket }), [market]);

  return (
    <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
  );
}

export function useMarket(): MarketContextValue {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}
