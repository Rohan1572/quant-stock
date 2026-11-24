import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE "score_results"
    ADD COLUMN "market" text NOT NULL DEFAULT 'india';
  `);
  pgm.sql(`DROP INDEX IF EXISTS "score_results_ticker_idx";`);
  pgm.sql(`
    CREATE UNIQUE INDEX "score_results_market_ticker_idx"
    ON "score_results" ("market", "ticker");
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP INDEX IF EXISTS "score_results_market_ticker_idx";`);
  pgm.sql(`ALTER TABLE "score_results" DROP COLUMN IF EXISTS "market";`);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS "score_results_ticker_idx"
    ON "score_results" ("ticker");
  `);
}
