import { pgTable, serial, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Category weights (as fractions summing to ~1) for the scoring engine.
// A row with sector = NULL is the platform default; other rows override
// weights for a specific sector (e.g. "Information Technology").
export const scoringConfigsTable = pgTable(
  "scoring_configs",
  {
    id: serial("id").primaryKey(),
    sector: text("sector"),
    valuationWeight: real("valuation_weight").notNull(),
    financialHealthWeight: real("financial_health_weight").notNull(),
    profitabilityWeight: real("profitability_weight").notNull(),
    growthWeight: real("growth_weight").notNull(),
    riskWeight: real("risk_weight").notNull(),
    momentumWeight: real("momentum_weight").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("scoring_configs_sector_idx").on(table.sector)],
);

export const insertScoringConfigSchema = createInsertSchema(
  scoringConfigsTable,
).omit({ id: true, updatedAt: true });
export type InsertScoringConfig = z.infer<typeof insertScoringConfigSchema>;
export type ScoringConfigRow = typeof scoringConfigsTable.$inferSelect;
