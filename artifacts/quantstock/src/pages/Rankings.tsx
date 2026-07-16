import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Trophy,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useGetRankings, useRefreshRankings, getGetRankingsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRecommendation(rec: string) {
  return rec.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getRecSentiment(rec: string): "buy" | "hold" | "sell" {
  if (rec.includes("buy")) return "buy";
  if (rec.includes("sell") || rec.includes("short") || rec.includes("reduce")) return "sell";
  return "hold";
}

function scoreColor(score: number) {
  if (score >= 70) return "bg-buy";
  if (score <= 40) return "bg-sell";
  return "bg-hold";
}

function scoreTextColor(score: number) {
  if (score >= 70) return "text-buy";
  if (score <= 40) return "text-sell";
  return "text-hold";
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatNextRefresh(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.ceil(diffMs / 60_000);
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.ceil(mins / 60)}h`;
}

// ── Row skeleton ─────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
      <Skeleton className="w-8 h-4 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
      <div className="w-32 hidden md:block space-y-1">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-8" />
      </div>
      <Skeleton className="h-6 w-20 rounded-md" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Rankings() {
  const { data, isLoading, refetch } = useGetRankings({
    query: {
      queryKey: getGetRankingsQueryKey(),
      refetchInterval: (q) => (q.state.data?.isRefreshing ? 5_000 : false),
    },
  });
  const { mutate: triggerRefresh, isPending: isTriggering } = useRefreshRankings();

  const [cooldownMsg, setCooldownMsg] = useState<string | null>(null);

  // Clear cooldown message once nextRefreshAt passes
  useEffect(() => {
    if (!data?.nextRefreshAt) { setCooldownMsg(null); return; }
    const ms = new Date(data.nextRefreshAt).getTime() - Date.now();
    if (ms <= 0) { setCooldownMsg(null); return; }
    const t = setTimeout(() => setCooldownMsg(null), ms);
    return () => clearTimeout(t);
  }, [data?.nextRefreshAt]);

  const isRefreshing = data?.isRefreshing ?? false;
  const canRefresh = !isRefreshing && !isTriggering && !cooldownMsg;

  function handleRefresh() {
    triggerRefresh(undefined, {
      onSuccess(result) {
        if (result.status === "rate_limited") {
          const next = result.nextRefreshAt
            ? formatNextRefresh(result.nextRefreshAt)
            : "soon";
          setCooldownMsg(`Available ${next}`);
        } else {
          refetch();
        }
      },
    });
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 97;
  const scored = data?.scored ?? 0;
  const progressPct = total > 0 ? Math.round((scored / total) * 100) : 0;

  return (
    <div className="flex-1 w-full bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-extrabold tracking-tight">Top Stocks</h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-lg">
              {total} NSE large/mid-cap stocks ranked by the QuantStock algorithm — valuation,
              profitability, growth, risk, and momentum.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button
              onClick={handleRefresh}
              disabled={!canRefresh}
              variant={isRefreshing ? "secondary" : "default"}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isTriggering ? "animate-spin" : ""}`} />
              {isRefreshing
                ? "Refreshing…"
                : isTriggering
                ? "Starting…"
                : cooldownMsg
                ? cooldownMsg
                : "Refresh Scores"}
            </Button>
            {data?.lastRefreshedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Last refreshed {formatRelativeTime(data.lastRefreshedAt)}
                {data.nextRefreshAt && !isRefreshing && (
                  <span>· Next {formatNextRefresh(data.nextRefreshAt)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scoring progress banner */}
        {!isLoading && scored < total && (
          <Card className={`mb-6 border-dashed ${isRefreshing ? "border-primary/40 bg-primary/5" : "bg-secondary/30"}`}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isRefreshing ? (
                    <><RefreshCw className="w-4 h-4 animate-spin text-primary" /> Scoring in progress…</>
                  ) : (
                    <><AlertCircle className="w-4 h-4 text-muted-foreground" /> Scores not yet loaded</>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-muted-foreground">
                  {scored} / {total}
                </span>
              </div>
              <Progress value={progressPct} indicatorColor="bg-primary" className="h-1.5 bg-secondary" />
              {!isRefreshing && scored === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Hit <strong>Refresh Scores</strong> to score all {total} stocks. Takes 2–3 minutes.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {scored > 0 ? `${scored} stocks ranked` : "No scores yet"}
              </CardTitle>
              <CardDescription className="text-xs">
                Refreshes are rate-limited to once per hour
              </CardDescription>
            </div>
          </CardHeader>

          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[3rem_1fr_8rem_10rem_7rem] gap-2 px-4 py-2 border-b bg-secondary/30 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="text-center">#</span>
            <span>Stock</span>
            <span className="text-center">Rating</span>
            <span>Score</span>
            <span />
          </div>

          {isLoading ? (
            <div>{Array.from({ length: 12 }).map((_, i) => <RowSkeleton key={i} />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Trophy className="w-12 h-12 text-muted-foreground/40 mb-4" />
              <p className="font-medium text-muted-foreground">No scores computed yet.</p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                Click <strong>Refresh Scores</strong> above to kick off the ranking engine. It scores
                all {total} stocks and takes 2–3 minutes.
              </p>
            </div>
          ) : (
            <div>
              {items.map((item) => {
                const sentiment = getRecSentiment(item.recommendation);
                return (
                  <Link key={item.ticker} href={`/stocks/${encodeURIComponent(item.ticker)}`}>
                    <div className="grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[3rem_1fr_8rem_10rem_7rem] gap-2 px-4 py-3 border-b last:border-0 items-center hover:bg-secondary/40 transition-colors cursor-pointer group">
                      {/* Rank */}
                      <div className={`text-center font-mono font-bold text-sm ${
                        item.rank <= 3 ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {item.rank <= 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-black">
                            {item.rank}
                          </span>
                        ) : item.rank}
                      </div>

                      {/* Company */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm truncate">{item.ticker.replace(".NS", "").replace(".BO", "")}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex shrink-0">
                            {item.ticker.endsWith(".BO") ? "BSE" : "NSE"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{item.companyName}</div>
                        {item.sector && (
                          <div className="text-[10px] text-muted-foreground/60 truncate hidden sm:block">{item.sector}</div>
                        )}
                      </div>

                      {/* Recommendation badge */}
                      <div className="flex justify-center sm:justify-center col-span-1 sm:col-span-1">
                        <Badge
                          variant={sentiment}
                          className="text-xs px-2.5 py-0.5 font-bold uppercase tracking-wide flex items-center gap-1"
                        >
                          {sentiment === "buy" && <TrendingUp className="w-3 h-3" />}
                          {sentiment === "sell" && <TrendingDown className="w-3 h-3" />}
                          {sentiment === "hold" && <Minus className="w-3 h-3" />}
                          <span className="hidden sm:inline">{formatRecommendation(item.recommendation)}</span>
                        </Badge>
                      </div>

                      {/* Score bar — hidden on mobile */}
                      <div className="hidden sm:block">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={item.overallScore}
                            indicatorColor={scoreColor(item.overallScore)}
                            className="h-2 flex-1 bg-secondary"
                          />
                          <span className={`font-mono font-bold text-sm w-7 shrink-0 text-right ${scoreTextColor(item.overallScore)}`}>
                            {Math.round(item.overallScore)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Confidence {Math.round(item.confidence)}%
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="hidden sm:flex justify-end">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Rankings are computed from live market data via Yahoo Finance (unofficial API — no SLA).
          Data is for informational purposes only and not investment advice.
        </p>
      </div>
    </div>
  );
}
