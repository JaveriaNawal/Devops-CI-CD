import "dotenv/config";
import app from "./app";
import logger from "./utils/logger";
import { connectDatabase, closeDatabaseConnection } from "./db/connection";
import * as appInsights from "applicationinsights";

// ── Application Insights (production only) ──────────────────
if (process.env.NODE_ENV === "production" && process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();

  logger.info("Azure Application Insights enabled");
}

const PORT = parseInt(process.env.PORT ?? "8080", 10);

async function bootstrap(): Promise<void> {
  // Try DB connection — warn but don't exit if unavailable (allows local dev without SQL Server)
  try {
    await connectDatabase();
    logger.info("✅ Database connected successfully");
  } catch (error) {
    logger.warn("⚠️  Database unavailable — server will start without DB. DB-dependent routes will return 503.");
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });

  // ── Graceful shutdown ──────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully...`);

    server.close(async () => {
      await closeDatabaseConnection();
      logger.info("💤 Server closed. Goodbye.");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error("Force shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap();
