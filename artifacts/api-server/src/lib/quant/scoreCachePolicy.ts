import { TransientProviderError } from "./providerErrors";

export interface CachedScore<T> {
  value: T;
  computedAt: Date;
  dcfAssumptions: unknown;
}

export function hasCurrentScoringMethod(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const assumptions = value as Record<string, unknown>;
  return (
    typeof assumptions.discountRate === "number" &&
    assumptions.discountRateType === "cost_of_equity"
  );
}

export function shouldServeStaleScore(
  error: unknown,
  dcfAssumptions: unknown,
): boolean {
  return (
    error instanceof TransientProviderError &&
    hasCurrentScoringMethod(dcfAssumptions)
  );
}

export async function resolveScoreCache<TCached, TScore>(options: {
  cached: CachedScore<TCached> | null;
  now: number;
  ttlMs: number;
  compute: () => Promise<TScore>;
  persist: (score: TScore) => Promise<void>;
  mapCached: (cached: TCached) => TScore;
  onStale?: (error: unknown, cached: TCached) => void;
}): Promise<TScore> {
  const { cached, now, ttlMs, compute, persist, mapCached, onStale } = options;

  if (
    cached &&
    now - cached.computedAt.getTime() < ttlMs &&
    hasCurrentScoringMethod(cached.dcfAssumptions)
  ) {
    return mapCached(cached.value);
  }

  let score: TScore;
  try {
    score = await compute();
  } catch (error) {
    if (cached && shouldServeStaleScore(error, cached.dcfAssumptions)) {
      onStale?.(error, cached.value);
      return mapCached(cached.value);
    }
    throw error;
  }

  await persist(score);
  return score;
}
