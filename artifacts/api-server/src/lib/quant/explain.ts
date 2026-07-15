import type { StockProfile, FinancialSnapshot } from "./provider";
import type {
  CategoryDetail,
  CategoryScores,
  Recommendation,
} from "./scoring";

export interface Factor {
  factor: string;
  direction: "positive" | "negative";
  weight: number;
}

export interface ScoreExplanation {
  reasons: string[];
  risks: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  valuation: "valuation",
  financialHealth: "financial health",
  profitability: "profitability",
  growth: "growth",
  risk: "risk profile",
  momentum: "price momentum",
};

// Deterministic, template-based explanation generation — no LLM involved.
// Every sentence is derived directly from the computed category/metric
// scores so the explanation is always traceable back to a number.
export function buildExplanation(
  profile: StockProfile,
  categories: CategoryDetail[],
  overallScore: number,
  recommendation: Recommendation,
): ScoreExplanation {
  const strong = categories.filter((c) => c.score >= 65);
  const weak = categories.filter((c) => c.score <= 40);

  const reasons: string[] = [];
  const risks: string[] = [];

  const recLabel = RECOMMENDATION_LABELS[recommendation];
  reasons.push(
    `${profile.companyName} scores ${Math.round(overallScore)}/100 overall, putting it in "${recLabel}" territory.`,
  );

  for (const cat of strong.slice(0, 3)) {
    reasons.push(
      `Strong ${CATEGORY_LABELS[cat.category] ?? cat.category} (${Math.round(
        cat.score,
      )}/100), driven by ${topMetricLabel(cat)}.`,
    );
  }

  for (const cat of weak.slice(0, 3)) {
    risks.push(
      `Weak ${CATEGORY_LABELS[cat.category] ?? cat.category} (${Math.round(
        cat.score,
      )}/100), dragged down by ${bottomMetricLabel(cat)}.`,
    );
  }

  if (reasons.length === 1) {
    reasons.push(
      "No single category stands out strongly — the score reflects a broadly average profile across valuation, health, profitability, growth, risk, and momentum.",
    );
  }

  if (risks.length === 0) {
    risks.push(
      "No individual category scored critically low, but all figures are drawn from a free, unofficial data feed and should be cross-checked before acting.",
    );
  }

  return { reasons, risks };
}

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  reduce: "Reduce",
  sell: "Sell",
  strong_short: "Strong Short",
};

function topMetricLabel(cat: CategoryDetail): string {
  const best = [...cat.metrics].sort((a, b) => b.score - a.score)[0];
  return best ? best.label.toLowerCase() : "its overall profile";
}

function bottomMetricLabel(cat: CategoryDetail): string {
  const worst = [...cat.metrics].sort((a, b) => a.score - b.score)[0];
  return worst ? worst.label.toLowerCase() : "its overall profile";
}

export function buildTopFactors(categories: CategoryDetail[]): Factor[] {
  return [...categories]
    .sort((a, b) => Math.abs(b.score - 50) * b.weight - Math.abs(a.score - 50) * a.weight)
    .slice(0, 5)
    .map((c) => ({
      factor: CATEGORY_LABELS[c.category] ?? c.category,
      direction: c.score >= 50 ? "positive" : "negative",
      weight: c.weight,
    }));
}

export function buildRiskFlags(
  fin: FinancialSnapshot,
  categories: CategoryDetail[],
): string[] {
  const flags: string[] = [];

  if (fin.debtToEquity != null && fin.debtToEquity > 1.5) {
    flags.push("High leverage: debt-to-equity ratio exceeds 1.5x.");
  }
  if (fin.currentRatio != null && fin.currentRatio < 1) {
    flags.push("Liquidity risk: current ratio is below 1.0.");
  }
  if (fin.beta != null && fin.beta > 1.5) {
    flags.push("High volatility: beta is above 1.5.");
  }
  if (fin.freeCashflow != null && fin.freeCashflow < 0) {
    flags.push("Negative free cash flow.");
  }
  const riskCategory = categories.find((c) => c.category === "risk");
  if (riskCategory && riskCategory.score < 35) {
    flags.push("Overall risk profile scores well below the sector norm.");
  }

  return flags;
}
