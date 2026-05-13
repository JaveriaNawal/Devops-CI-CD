import "dotenv/config";
import sql from "mssql";
import { connectDatabase, closeDatabaseConnection } from "../db/connection";
import logger from "../utils/logger";

// ── Migration definitions ─────────────────────────────────────
interface Migration {
  version: number;
  name:    string;
  up:      string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name:    "create_migrations_table",
    up: `
      IF NOT EXISTS (
        SELECT * FROM sys.tables WHERE name = 'schema_migrations'
      )
      CREATE TABLE schema_migrations (
        version      INT          NOT NULL PRIMARY KEY,
        name         NVARCHAR(255) NOT NULL,
        applied_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE()
      );
    `,
  },
  {
    version: 2,
    name:    "create_users_table",
    up: `
      IF NOT EXISTS (
        SELECT * FROM sys.tables WHERE name = 'users'
      )
      CREATE TABLE users (
        id            INT           IDENTITY(1,1) PRIMARY KEY,
        name          NVARCHAR(100) NOT NULL,
        email         NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        active        BIT           NOT NULL DEFAULT 1,
        created_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        updated_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_users_email ON users (email);
    `,
  },
  {
    version: 3,
    name:    "create_audit_log_table",
    up: `
      IF NOT EXISTS (
        SELECT * FROM sys.tables WHERE name = 'audit_log'
      )
      CREATE TABLE audit_log (
        id         BIGINT        IDENTITY(1,1) PRIMARY KEY,
        user_id    INT           NULL REFERENCES users(id),
        action     NVARCHAR(100) NOT NULL,
        entity     NVARCHAR(100) NOT NULL,
        entity_id  INT           NULL,
        details    NVARCHAR(MAX) NULL,
        ip_address NVARCHAR(50)  NULL,
        created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_audit_log_user_id    ON audit_log (user_id);
      CREATE INDEX IX_audit_log_created_at ON audit_log (created_at);
    `,
  },
];

// ── Runner ────────────────────────────────────────────────────
async function runMigrations(): Promise<void> {
  logger.info("Starting database migrations...");
  await connectDatabase();

  const pool = (await import("../db/connection")).getPool();

  // Ensure the migrations tracking table exists first
  await pool.request().query(migrations[0].up);
  logger.info(`✅ Migration 1: ${migrations[0].name}`);

  for (const migration of migrations.slice(1)) {
    const existing = await pool.request()
      .input("version", sql.Int, migration.version)
      .query("SELECT version FROM schema_migrations WHERE version = @version");

    if (existing.recordset.length > 0) {
      logger.info(`⏭  Migration ${migration.version}: ${migration.name} — already applied, skipping`);
      continue;
    }

    logger.info(`⏳ Applying migration ${migration.version}: ${migration.name}...`);
    await pool.request().query(migration.up);

    await pool.request()
      .input("version", sql.Int, migration.version)
      .input("name",    sql.NVarChar, migration.name)
      .query("INSERT INTO schema_migrations (version, name) VALUES (@version, @name)");

    logger.info(`✅ Migration ${migration.version}: ${migration.name} — applied`);
  }

  logger.info("All migrations complete.");
  await closeDatabaseConnection();
}

runMigrations().catch((err) => {
  logger.error("Migration failed:", err);
  process.exit(1);
});
