-- ============================================================
--  db/schema.sql
--  Run this against Azure SQL Database using Azure Data Studio
--  or the Azure Portal Query Editor to initialise the schema.
-- ============================================================

-- ── Users table ───────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
CREATE TABLE users (
    id            INT           IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100) NOT NULL,
    email         NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    active        BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    updated_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_email')
    CREATE INDEX IX_users_email ON users (email);

-- ── Tasks table ───────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tasks')
CREATE TABLE tasks (
    id          INT            IDENTITY(1,1) PRIMARY KEY,
    user_id     INT            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       NVARCHAR(255)  NOT NULL,
    description NVARCHAR(MAX)  NULL,
    status      NVARCHAR(50)   NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority    NVARCHAR(20)   NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('low', 'medium', 'high')),
    due_date    DATETIME2      NULL,
    created_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_tasks_user_id   ON tasks (user_id);
CREATE INDEX IX_tasks_status    ON tasks (status);
CREATE INDEX IX_tasks_due_date  ON tasks (due_date);

-- ── Audit log table ───────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_log')
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

-- ── Schema migrations tracking ────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'schema_migrations')
CREATE TABLE schema_migrations (
    version    INT           NOT NULL PRIMARY KEY,
    name       NVARCHAR(255) NOT NULL,
    applied_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
);

INSERT INTO schema_migrations (version, name) VALUES
(1, 'create_migrations_table'),
(2, 'create_users_table'),
(3, 'create_audit_log_table'),
(4, 'create_tasks_table');

PRINT 'Schema initialised successfully.';
