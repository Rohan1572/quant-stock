import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import scoringConfigRouter from "./scoringConfig";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stocksRouter);
router.use(scoringConfigRouter);

export default router;
