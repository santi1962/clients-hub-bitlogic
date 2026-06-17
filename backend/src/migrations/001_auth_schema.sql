-- ============================================================
-- Migration 001 — Auth schema
-- Tablas: users, refresh_tokens
-- Idempotente: usa IF NOT EXISTS en todos los objetos
-- ============================================================

-- Extensión para gen_random_uuid() en PostgreSQL < 13
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- Tabla: users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active',
  phone         TEXT,
  client_id     UUID,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique  UNIQUE (email),
  CONSTRAINT users_role_check    CHECK (role   IN ('super_admin','admin','soporte','finanzas','cliente')),
  CONSTRAINT users_status_check  CHECK (status IN ('active','inactive'))
);

-- ─────────────────────────────────────────
-- Tabla: refresh_tokens
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

-- ─────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
  ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;
