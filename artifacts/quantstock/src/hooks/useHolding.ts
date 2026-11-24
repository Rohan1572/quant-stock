import { useState, useEffect, useCallback } from "react";

export interface Holding {
  quantity: number;
  avgCost: number; // per share, in the stock's currency
}

const key = (ticker: string, market: "india" | "us") =>
  market === "india"
    ? `qs_holding_${ticker.toUpperCase()}`
    : `qs_holding_${market}_${ticker.toUpperCase()}`;

export function useHolding(ticker: string, market: "india" | "us" = "india") {
  const [holding, setHolding] = useState<Holding | null>(() => {
    try {
      const raw = localStorage.getItem(key(ticker, market));
      return raw ? (JSON.parse(raw) as Holding) : null;
    } catch {
      return null;
    }
  });

  // Keep in sync if ticker changes (e.g. browser back/forward navigation)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(ticker, market));
      setHolding(raw ? (JSON.parse(raw) as Holding) : null);
    } catch {
      setHolding(null);
    }
  }, [ticker, market]);

  const saveHolding = useCallback(
    (h: Holding) => {
      localStorage.setItem(key(ticker, market), JSON.stringify(h));
      setHolding(h);
    },
    [market, ticker],
  );

  const clearHolding = useCallback(() => {
    localStorage.removeItem(key(ticker, market));
    setHolding(null);
  }, [market, ticker]);

  return { holding, saveHolding, clearHolding };
}
