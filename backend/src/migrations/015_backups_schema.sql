-- Migration 015 — Backups table
CREATE TABLE IF NOT EXISTS backups (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'database',
  size_mb    NUMERIC     NOT NULL DEFAULT 0,
  status     TEXT        NOT NULL DEFAULT 'in_progress',
  file_path  TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT backups_type_check   CHECK (type   IN ('database', 'files', 'full')),
  CONSTRAINT backups_status_check CHECK (status IN ('success', 'failed', 'in_progress'))
);
