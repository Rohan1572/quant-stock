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
  const scoringDataPromise = provider.getScoringData(ticker).then((data) => {
    const profile = data.profile;
    if (!profile) throw new TickerNotFoundError(ticker);
    return { ...data, profile };
  });
  const priceHistoryPromise = provider.getPriceHistory(ticker, "1y").then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

  const [scoringData, priceHistory] = await Promise.all([
    scoringDataPromise,
    priceHistoryPromise,
  ]);
  if (!priceHistory.ok) throw priceHistory.error;

  return {
    profile: scoringData.profile,
    financialSnapshot: scoringData.financialSnapshot,
    priceHistory: priceHistory.value,
  };
}