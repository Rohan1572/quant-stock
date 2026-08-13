export const shorthands = undefined;

export function up(pgm: any): void {
  pgm.sql(`
    CREATE TABLE "scoring_configs" (
      "id" serial PRIMARY KEY,
      "sector" text,
      "valuation_weight" real NOT NULL,
      "financial_health_weight" real NOT NULL,
      "profitability_weight" real NOT NULL,
      "growth_weight" real NOT NULL,
      "risk_weight" real NOT NULL,
      "momentum_weight" real NOT NULL,
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX "scoring_configs_sector_idx"
    ON "scoring_configs" ("sector");
  `);

  pgm.sql(`
    CREATE TABLE "score_results" (
      "id" serial PRIMARY KEY,
      "ticker" text NOT NULL,
      "computed_at" timestamp with time zone NOT NULL DEFAULT now(),
      "overall_score" real NOT NULL,
      "recommendation" text NOT NULL,
      "confidence" real NOT NULL,
      "fair_value_estimate" real,
      "category_scores" jsonb NOT NULL,
      "categories" jsonb NOT NULL,
      "top_factors" jsonb NOT NULL,
      "risk_flags" jsonb NOT NULL,
      "explanation" jsonb NOT NULL,
      "dcf_assumptions" jsonb NOT NULL
    );
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX "score_results_ticker_idx"
    ON "score_results" ("ticker");
  `);
}

export function down(pgm: any): void {
  pgm.sql(`DROP TABLE IF EXISTS "score_results";`);
  pgm.sql(`DROP TABLE IF EXISTS "scoring_configs";`);
}
