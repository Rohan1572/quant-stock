import { Router, type IRouter } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, scoringConfigsTable } from "@workspace/db";
import {
  ListScoringConfigsResponse,
  UpsertScoringConfigBody,
  UpsertScoringConfigResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const WEIGHT_SUM_TOLERANCE = 0.02;

router.get("/scoring-config", async (_req, res): Promise<void> => {
  const configs = await db.select().from(scoringConfigsTable);
  res.json(ListScoringConfigsResponse.parse(configs));
});

router.post("/scoring-config", async (req, res): Promise<void> => {
  const parsed = UpsertScoringConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weights = parsed.data;
  const total =
    weights.valuationWeight +
    weights.financialHealthWeight +
    weights.profitabilityWeight +
    weights.growthWeight +
    weights.riskWeight +
    weights.momentumWeight;

  if (Math.abs(total - 1) > WEIGHT_SUM_TOLERANCE) {
    res.status(400).json({
      error: `Category weights must sum to 1.0 (got ${total.toFixed(3)})`,
    });
    return;
  }

  // Postgres unique indexes treat NULL as distinct from every other NULL, so
  // a unique index on `sector` alone cannot be relied on to dedupe the
  // platform-default (sector = null) row via onConflictDoUpdate. Look the
  // row up manually and update-or-insert instead.
  const existingQuery =
    weights.sector == null
      ? db
          .select()
          .from(scoringConfigsTable)
          .where(isNull(scoringConfigsTable.sector))
      : db
          .select()
          .from(scoringConfigsTable)
          .where(eq(scoringConfigsTable.sector, weights.sector));

  const [existing] = await existingQuery.limit(1);

  const [saved] = existing
    ? await db
        .update(scoringConfigsTable)
        .set({ ...weights, updatedAt: new Date() })
        .where(eq(scoringConfigsTable.id, existing.id))
        .returning()
    : await db.insert(scoringConfigsTable).values(weights).returning();

  res.json(UpsertScoringConfigResponse.parse(saved));
});

export default router;
