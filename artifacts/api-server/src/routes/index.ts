import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import scoringConfigRouter from "./scoringConfig";
import rankingsRouter from "./rankings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stocksRouter);
router.use(scoringConfigRouter);
router.use(rankingsRouter);

export default router;
