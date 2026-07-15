import { useState, useEffect, useCallback } from "react";

export interface Holding {
  quantity: number;
  avgCost: number; // per share, in the stock's currency
}

const key = (ticker: string) => `qs_holding_${ticker.toUpperCase()}`;

export function useHolding(ticker: string) {
  const [holding, setHoldingState] = useState<Holding | null>(() => {
    try {
      const raw = localStorage.getItem(key(ticker));
      return raw ? (JSON.parse(raw) as Holding) : null;
    } catch {
      return null;
    }
  });

  // Keep in sync if ticker changes (e.g. browser back/forward navigation)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(ticker));
      setHoldingState(raw ? (JSON.parse(raw) as Holding) : null);
    } catch {
      setHoldingState(null);
    }
  }, [ticker]);

  const saveHolding = useCallback(
    (h: Holding) => {
      localStorage.setItem(key(ticker), JSON.stringify(h));
      setHoldingState(h);
    },
    [ticker],
  );

  const clearHolding = useCallback(() => {
    localStorage.removeItem(key(ticker));
    setHoldingState(null);
  }, [ticker]);

  return { holding, saveHolding, clearHolding };
}
