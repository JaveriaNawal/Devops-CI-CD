import { Router, Request, Response } from "express";
import { getPool } from "../db/connection";
import logger from "../utils/logger";

export const healthRouter = Router();

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: "ok" | "error";
    memory: "ok" | "warning" | "error";
  };
}

/**
 * GET /api/health
 * Used by Azure App Service for health probes and smoke tests in the pipeline.
 */
healthRouter.get("/", async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "unknown",
    uptime: Math.floor(process.uptime()),
    checks: {
      database: "ok",
      memory: "ok",
    },
  };

  // ── Database ping ──────────────────────────────────────────
  try {
    const pool = getPool();
    await pool.request().query("SELECT 1 AS ping");
  } catch (err) {
    logger.warn("Health check DB ping failed:", err);
    status.checks.database = "error";
    status.status = "degraded";
  }

  // ── Memory check (warn >85% heap) ─────────────────────────
  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapPercent > 95) {
    status.checks.memory = "error";
    status.status = "degraded";
  } else if (heapPercent > 85) {
    status.checks.memory = "warning";
  }

  const httpStatus = status.status === "healthy" ? 200 : 503;
  const responseTime = Date.now() - startTime;

  return res.status(httpStatus)
    .set("X-Response-Time", `${responseTime}ms`)
    .json(status);
});

/**
 * GET /api/health/ready
 * Kubernetes/App Service readiness probe — only returns 200 when DB is ready.
 */
healthRouter.get("/ready", async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    await pool.request().query("SELECT 1");
    return res.status(200).json({ ready: true });
  } catch {
    return res.status(503).json({ ready: false });
  }
});
