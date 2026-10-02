import {
  pgTable,
  serial,
  text,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cached, computed score for a ticker. Scores are computed on-demand when
// requested and cached here for a short TTL so repeated lookups don't
// re-hit the upstream data provider or recompute the quant model.
export const scoreResultsTable = pgTable(
  "score_results",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    overallScore: real("overall_score").notNull(),
    recommendation: text("recommendation").notNull(),
    confidence: real("confidence").notNull(),
    // "low" | "moderate" | "high"
    confidenceLevel: text("confidence_level"),
    // Per-component drivers behind `confidence`, making it explainable.
    confidenceBreakdown: jsonb("confidence_breakdown"),
    // { low, high } 95% interval around overall_score.
    scoreRange: jsonb("score_range"),
    // Score shrunk toward neutral for uncertainty; drives the recommendation.
    adjustedScore: real("adjusted_score"),
    // Importance-weighted share of the model with usable data, 0-1.
    dataCoverage: real("data_coverage"),
    fairValueEstimate: real("fair_value_estimate"),
    categoryScores: jsonb("category_scores").notNull(),
    categories: jsonb("categories").notNull(),
    topFactors: jsonb("top_factors").notNull(),
    riskFlags: jsonb("risk_flags").notNull(),
    explanation: jsonb("explanation").notNull(),
    dcfAssumptions: jsonb("dcf_assumptions").notNull(),
  },
  (table) => [uniqueIndex("score_results_ticker_idx").on(table.ticker)],
);

export const insertScoreResultSchema = createInsertSchema(
  scoreResultsTable,
).omit({ id: true });
export type InsertScoreResult = z.infer<typeof insertScoreResultSchema>;
export type ScoreResultRow = typeof scoreResultsTable.$inferSelect;
