import { logger } from "../logger";
import { singleFlight } from "./singleFlight";
import { TransientProviderError } from "./providerErrors";

// Thin, low-level client for Yahoo Finance's unofficial public endpoints.
// This is a *prototype-tier* data source (see .local/skills — no SLA, can
// change without notice). It is wrapped behind the DataProvider interface
// in provider.ts so it can be swapped for a licensed provider later without
// touching the scoring engine.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 20_000;

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let crumbFetchedAt = 0;
const CRUMB_TTL_MS = 30 * 60 * 1000;
const quoteSummaryRequests = new Map<
  string,
  Promise<YahooQuoteSummary | null>
>();
const chartRequests = new Map<string, Promise<YahooChartPoint[]>>();
const crumbRefreshRequests = new Map<
  string,
  Promise<{ cookie: string; crumb: string }>
>();

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new TransientProviderError(
      "Yahoo Finance request could not be completed",
      err,
    );
  }
}

function throwHttpError(status: number, url: string): never {
  const message = `Yahoo Finance request failed: ${status} ${url}`;
  if (status === 408 || status === 429 || status >= 500) {
    throw new TransientProviderError(message);
  }
  throw new Error(message);
}

async function refreshCrumb(): Promise<{ cookie: string; crumb: string }> {
  // Step 1: hit a Yahoo endpoint to collect session cookies.
  const cookieRes = await fetchWithTimeout("https://fc.yahoo.com", {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
  });
  const setCookie = cookieRes.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : "";

  // Step 2: exchange the cookie for a crumb.
  const crumbRes = await fetchWithTimeout(
    "https://query1.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: {
        "User-Agent": USER_AGENT,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    },
  );
  const crumb = (await crumbRes.text()).trim();

  if (!crumb || crumb.includes("<html")) {
    throw new Error("Failed to obtain Yahoo Finance crumb");
  }

  cachedCookie = cookie;
  cachedCrumb = crumb;
  crumbFetchedAt = Date.now();
  return { cookie, crumb };
}

function getCrumb(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCrumb && Date.now() - crumbFetchedAt < CRUMB_TTL_MS) {
    return Promise.resolve({ cookie: cachedCookie ?? "", crumb: cachedCrumb });
  }
  return singleFlight(crumbRefreshRequests, "yahoo", refreshCrumb);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throwHttpError(res.status, url);
  }
  return res.json();
}

async function fetchJsonWithCrumb(
  baseUrl: string,
  params: Record<string, string>,
): Promise<unknown> {
  const attempt = async (): Promise<Response> => {
    const { cookie, crumb } = await getCrumb();
    const qs = new URLSearchParams({ ...params, crumb });
    const res = await fetchWithTimeout(`${baseUrl}?${qs.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    return res;
  };

  let res = await attempt();
  if (res.status === 401) {
    // Crumb likely stale — force a refresh and retry once.
    cachedCrumb = null;
    res = await attempt();
  }
  if (!res.ok) {
    throwHttpError(res.status, baseUrl);
  }
  const body = (await res.json()) as { finance?: { error?: unknown } };
  if (body?.finance?.error) {
    throw new Error(
      `Yahoo Finance error: ${JSON.stringify(body.finance.error)}`,
    );
  }
  return body;
}

export interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  quoteType?: string;
}

export async function yahooSearch(query: string): Promise<YahooSearchQuote[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?${new URLSearchParams(
    { q: query, quotesCount: "10", newsCount: "0" },
  ).toString()}`;
  try {
    const data = (await fetchJson(url)) as { quotes?: YahooSearchQuote[] };
    return (data.quotes ?? []).filter((q) => q.quoteType === "EQUITY");
  } catch (err) {
    logger.error({ err, query }, "Yahoo Finance search failed");
    return [];
  }
}

export interface YahooChartPoint {
  date: string;
  close: number;
  volume: number;
}

const RANGE_TO_YAHOO: Record<string, { range: string; interval: string }> = {
  "1m": { range: "1mo", interval: "1d" },
  "6m": { range: "6mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
  "5y": { range: "5y", interval: "1wk" },
};

export function yahooChart(
  ticker: string,
  range: "1m" | "6m" | "1y" | "5y",
): Promise<YahooChartPoint[]> {
  const normalizedTicker = ticker.toUpperCase();
  const key = `${normalizedTicker}:${range}`;
  return singleFlight(chartRequests, key, () =>
    fetchYahooChart(normalizedTicker, range),
  );
}

async function fetchYahooChart(
  ticker: string,
  range: "1m" | "6m" | "1y" | "5y",
): Promise<YahooChartPoint[]> {
  const { range: yRange, interval } = RANGE_TO_YAHOO[range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=${yRange}&interval=${interval}&includeAdjustedClose=true`;
  const data = (await fetchJson(url)) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: (number | null)[];
            volume?: (number | null)[];
          }>;
          adjclose?: Array<{
            adjclose?: (number | null)[];
          }>;
        };
      }>;
      error?: unknown;
    };
  };
  const result = data.chart?.result?.[0];
  if (!result || data.chart?.error) {
    throw new Error(`No chart data for ${ticker}`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const adjustedCloses = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const volumes = result.indicators?.quote?.[0]?.volume ?? [];
  const points: YahooChartPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const rawClose = closes[i];
    const adjustedClose = adjustedCloses[i];
    const close =
      typeof adjustedClose === "number" && Number.isFinite(adjustedClose)
        ? adjustedClose
        : rawClose;
    if (close == null) continue;
    points.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
      volume: volumes[i] ?? 0,
    });
  }
  return points;
}

export interface YahooQuoteSummary {
  price?: Record<string, unknown>;
  summaryDetail?: Record<string, unknown>;
  defaultKeyStatistics?: Record<string, unknown>;
  financialData?: Record<string, unknown>;
  assetProfile?: Record<string, unknown>;
}

const QUOTE_SUMMARY_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "assetProfile",
].join(",");

export function yahooQuoteSummary(
  ticker: string,
): Promise<YahooQuoteSummary | null> {
  const key = ticker.toUpperCase();
  return singleFlight(quoteSummaryRequests, key, () =>
    fetchYahooQuoteSummary(key),
  );
}

async function fetchYahooQuoteSummary(
  ticker: string,
): Promise<YahooQuoteSummary | null> {
  const baseUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}`;
  try {
    const data = (await fetchJsonWithCrumb(baseUrl, {
      modules: QUOTE_SUMMARY_MODULES,
    })) as { quoteSummary?: { result?: YahooQuoteSummary[] } };
    return data.quoteSummary?.result?.[0] ?? null;
  } catch (err) {
    logger.error({ err, ticker }, "Yahoo Finance quoteSummary failed");
    throw err;
  }
}

// Yahoo wraps most numeric fields as { raw, fmt }. Unwrap defensively.
export function raw(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "raw" in (value as Record<string, unknown>)
  ) {
    const r = (value as { raw?: unknown }).raw;
    return typeof r === "number" ? r : null;
  }
  return null;
}
