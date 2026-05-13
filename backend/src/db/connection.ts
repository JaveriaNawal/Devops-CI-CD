import sql from "mssql";
import logger from "../utils/logger";

// ── Connection pool singleton ────────────────────────────────
let pool: sql.ConnectionPool | null = null;

const getConfig = (): sql.config => {
  const connectionString = process.env.SQL_CONNECTION_STRING;

  if (connectionString) {
    // Azure Key Vault reference or env-level connection string
    return { connectionString } as any;
  }

  // Fallback: individual env vars (local dev)
  return {
    server:   process.env.SQL_SERVER   ?? "localhost",
    database: process.env.SQL_DATABASE ?? "appdb",
    user:     process.env.SQL_USER     ?? "sa",
    password: process.env.SQL_PASSWORD ?? "",
    port:     parseInt(process.env.SQL_PORT ?? "1433", 10),
    options: {
      encrypt: true,                  // Required for Azure SQL
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true", // true for local dev
      enableArithAbort: true,
    },
    pool: {
      max:              10,
      min:               2,
      idleTimeoutMillis: 30_000,
      acquireTimeoutMillis: 15_000,
    },
    connectionTimeout: 15_000,
    requestTimeout:    30_000,
  };
};

export async function connectDatabase(): Promise<void> {
  try {
    pool = await new sql.ConnectionPool(getConfig()).connect();

    pool.on("error", (err: Error) => {
      logger.error("SQL pool error:", err);
    });

    logger.info("SQL Server connection pool established");
  } catch (err) {
    logger.error("Failed to connect to Azure SQL Database:", err);
    throw err;
  }
}

export function getPool(): sql.ConnectionPool {
  if (!pool || !pool.connected) {
    throw new Error("Database pool not initialised — call connectDatabase() first");
  }
  return pool;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info("SQL Server connection pool closed");
  }
}
