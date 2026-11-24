import { useState } from "react";
import {
  Wallet,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHolding } from "@/hooks/useHolding";
import { getPositionAdvice } from "@/lib/positionAdvice";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Market } from "@/contexts/MarketContext";

interface Props {
  readonly ticker: string;
  readonly currentPrice: number;
  readonly currency?: string;
  readonly score: number;
  readonly market?: Market;
}

export function PositionCard({
  ticker,
  currentPrice,
  currency = "INR",
  score,
  market = "india",
}: Props) {
  const { holding, saveHolding, clearHolding } = useHolding(ticker, market);
  const [editing, setEditing] = useState(!holding);
  const [qty, setQty] = useState(holding?.quantity?.toString() ?? "");
  const [avgCost, setAvgCost] = useState(holding?.avgCost?.toString() ?? "");
  const [errors, setErrors] = useState<{ qty?: string; avgCost?: string }>({});

  const locale = currency === "INR" ? "en-IN" : "en-US";

  function validate() {
    const e: typeof errors = {};
    const q = Number.parseFloat(qty);
    const c = Number.parseFloat(avgCost);
    if (!qty || Number.isNaN(q) || q <= 0) e.qty = "Enter a valid quantity";
    if (!avgCost || Number.isNaN(c) || c <= 0)
      e.avgCost = "Enter a valid price";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    saveHolding({
      quantity: Number.parseFloat(qty),
      avgCost: Number.parseFloat(avgCost),
    });
    setEditing(false);
  }

  function handleEdit() {
    if (holding) {
      setQty(holding.quantity.toString());
      setAvgCost(holding.avgCost.toString());
    }
    setErrors({});
    setEditing(true);
  }

  function handleClear() {
    clearHolding();
    setQty("");
    setAvgCost("");
    setErrors({});
    setEditing(true);
  }

  // ── Entry form ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4 text-primary" />
            {holding ? "Edit My Holding" : "Add My Holding"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Enter your position so we can give you advice based on your cost
            basis, not just the stock fundamentals.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Shares owned</Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 50"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={errors.qty ? "border-destructive" : ""}
              />
              {errors.qty && (
                <p className="text-xs text-destructive">{errors.qty}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avgCost">Average buy price ({currency})</Label>
              <Input
                id="avgCost"
                type="number"
                min="0"
                step="any"
                placeholder={currency === "INR" ? "e.g. ₹1100" : "e.g. $110"}
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                className={errors.avgCost ? "border-destructive" : ""}
              />
              {errors.avgCost && (
                <p className="text-xs text-destructive">{errors.avgCost}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Save Position
            </Button>
            {holding && (
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Position summary + advice ─────────────────────────────────────────────
  const { quantity, avgCost: cost } = holding!;
  const invested = quantity * cost;
  const currentValue = quantity * currentPrice;
  const pnlAbs = currentValue - invested;
  const pnlPct = ((currentPrice - cost) / cost) * 100;
  const advice = getPositionAdvice(score, pnlPct);

  const sentimentColors = {
    buy: {
      bg: "bg-buy/10 border-buy/30",
      badge: "buy" as const,
      icon: <TrendingUp className="w-4 h-4" />,
    },
    hold: {
      bg: "bg-hold/10 border-hold/30",
      badge: "secondary" as const,
      icon: <Minus className="w-4 h-4" />,
    },
    sell: {
      bg: "bg-sell/10 border-sell/30",
      badge: "sell" as const,
      icon: <TrendingDown className="w-4 h-4" />,
    },
  };
  const colors = sentimentColors[advice.sentiment];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4 text-primary" />
            My Position
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleEdit}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Shares" value={quantity.toLocaleString(locale)} mono />
          <Stat label="Avg Cost" value={formatCurrency(cost, currency)} mono />
          <Stat
            label="Current Value"
            value={formatCurrency(currentValue, currency, 0)}
            mono
          />
          <div className="p-3 rounded-lg bg-secondary/40 border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Unrealised P&amp;L
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                pnlAbs >= 0 ? "text-buy" : "text-sell"
              }`}
            >
              {pnlAbs >= 0 ? "+" : ""}
              {formatCurrency(Math.abs(pnlAbs), currency, 0)}
            </div>
            <div
              className={`text-xs font-mono mt-0.5 ${
                pnlPct >= 0 ? "text-buy" : "text-sell"
              }`}
            >
              {pnlPct >= 0 ? "+" : ""}
              {pnlPct.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Position-aware guidance */}
        <div className={`rounded-xl border p-4 ${colors.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What This Means For You
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Badge
              variant={colors.badge}
              className="shrink-0 text-sm px-3 py-1 font-bold uppercase tracking-wide flex items-center gap-1.5"
            >
              {colors.icon}
              {advice.label}
            </Badge>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {advice.rationale}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-secondary/40 border">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-bold ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
