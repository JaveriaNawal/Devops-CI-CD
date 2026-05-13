import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { apiRouter } from "./routes/api";
import logger from "./utils/logger";

const app: Application = express();

// ── Security middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// ── General middleware ───────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth",   authRouter);
app.use("/api",        apiRouter);

// ── Root route — API info page ───────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>MyApp API</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0c29; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2.5rem 3rem; max-width: 480px; text-align: center; }
    h1 { font-size: 2rem; margin: 0 0 0.5rem; } span { font-size: 2.5rem; }
    p { color: rgba(255,255,255,0.5); margin: 0 0 2rem; }
    a { display: inline-block; padding: 0.75rem 1.5rem; background: linear-gradient(135deg,#818cf8,#6366f1); color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 0.25rem; }
    .routes { text-align: left; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 1rem 1.5rem; margin-top: 1.5rem; font-size: 0.85rem; }
    .routes code { color: #a5b4fc; }
  </style>
</head>
<body>
  <div class="card">
    <span>⚡</span>
    <h1>MyApp API</h1>
    <p>Backend is running in <strong>${process.env.NODE_ENV ?? "development"}</strong> mode</p>
    <a href="http://localhost:5173">Open Frontend App →</a>
    <a href="/api/health">Health Check</a>
    <div class="routes">
      <strong>Available endpoints:</strong><br/><br/>
      <code>GET  /api/health</code> — liveness + readiness<br/>
      <code>POST /api/auth/login</code> — authenticate<br/>
      <code>POST /api/auth/register</code> — create account<br/>
      <code>GET  /api/resources</code> — protected resources
    </div>
  </div>
</body>
</html>`);
});

// ── 404 handler ──────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ─────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error:", err);
  const status = (err as any).status ?? 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
  });
});

export default app;
