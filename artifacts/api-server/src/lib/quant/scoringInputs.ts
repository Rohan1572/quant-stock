import type {
  DataProvider,
  FinancialSnapshot,
  PricePoint,
  StockProfile,
} from "./provider";

export class TickerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Ticker not found: ${ticker}`);
  }
}

export interface ScoringInputs {
  profile: StockProfile;
  financialSnapshot: FinancialSnapshot | null;
  priceHistory: PricePoint[];
}

export async function fetchScoringInputs(
  provider: Pick<DataProvider, "getScoringData" | "getPriceHistory">,
  ticker: string,
): Promise<ScoringInputs> {
  const [scoringData, priceHistory] = await Promise.allSettled([
    provider.getScoringData(ticker),
    provider.getPriceHistory(ticker, "1y"),
  ]);

  if (scoringData.status === "rejected") throw scoringData.reason;
  if (!scoringData.value.profile) throw new TickerNotFoundError(ticker);
  if (priceHistory.status === "rejected") throw priceHistory.reason;

  return {
    profile: scoringData.value.profile,
    financialSnapshot: scoringData.value.financialSnapshot,
    priceHistory: priceHistory.value,
  };
}