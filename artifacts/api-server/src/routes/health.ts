import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Root /api handler — returns 200 so uptime monitors don't flag it as down
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
