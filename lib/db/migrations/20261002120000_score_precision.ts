// Adds the score-precision fields: an uncertainty band around the score, the
// confidence breakdown that explains it, and the confidence-shrunk score that
// actually drives the recommendation.
//
// Columns are nullable so existing cached rows keep working; the engine falls
// back to sensible defaults when they are absent.
export const shorthands = undefined;

export function up(pgm: any): void {
  pgm.sql(`
    ALTER TABLE "score_results"
      ADD COLUMN IF NOT EXISTS "confidence_level" text,
      ADD COLUMN IF NOT EXISTS "confidence_breakdown" jsonb,
      ADD COLUMN IF NOT EXISTS "score_range" jsonb,
      ADD COLUMN IF NOT EXISTS "adjusted_score" real,
      ADD COLUMN IF NOT EXISTS "data_coverage" real;
  `);

  // Backfill older rows so rankings do not show null score metadata. The band
  // collapses to the point estimate — honest for a score computed by the old model.
  pgm.sql(`
    UPDATE "score_results"
    SET
      "confidence_level" = CASE
        WHEN "confidence" >= 75 THEN 'high'
        WHEN "confidence" >= 50 THEN 'moderate'
        ELSE 'low'
      END,
      "score_range" = jsonb_build_object('low', "overall_score", 'high', "overall_score"),
      "adjusted_score" = "overall_score",
      "data_coverage" = LEAST(GREATEST("confidence" / 100.0, 0), 1)
    WHERE "confidence_level" IS NULL;
  `);
}

export function down(pgm: any): void {
  pgm.sql(`
    ALTER TABLE "score_results"
      DROP COLUMN IF EXISTS "confidence_level",
      DROP COLUMN IF EXISTS "confidence_breakdown",
      DROP COLUMN IF EXISTS "score_range",
      DROP COLUMN IF EXISTS "adjusted_score",
      DROP COLUMN IF EXISTS "data_coverage";
  `);
}
