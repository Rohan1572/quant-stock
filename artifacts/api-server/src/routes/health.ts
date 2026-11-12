import { Router, type IRouter } from "express";
import { GetHealthStatusResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  const data = GetHealthStatusResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
