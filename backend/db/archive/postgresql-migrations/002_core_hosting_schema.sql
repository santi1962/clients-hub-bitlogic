-- ============================================================
-- Migration 002 — Core hosting schema
-- Tablas: clients, hosting_plans, hosting_services
-- Idempotente: usa IF NOT EXISTS en todos los objetos
-- ============================================================

-- ─────────────────────────────────────────
-- Función para updated_at automático
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────
-- Tabla: clients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  company     TEXT,
  email       TEXT        NOT NULL,
  phone       TEXT,
  tax_id      TEXT,
  status      TEXT        NOT NULL DEFAULT 'active',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive'))
);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Tabla: hosting_plans
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hosting_plans (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT           NOT NULL,
  description     TEXT,
  storage_gb      INTEGER        NOT NULL,
  websites_limit  INTEGER,       -- NULL = ilimitados
  emails_limit    INTEGER,       -- NULL = ilimitados
  monthly_price   NUMERIC(12,2)  NOT NULL,
  status          TEXT           NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT hosting_plans_status_check CHECK (status IN ('active', 'inactive'))
);

DROP TRIGGER IF EXISTS trg_hosting_plans_updated_at ON hosting_plans;
CREATE TRIGGER trg_hosting_plans_updated_at
  BEFORE UPDATE ON hosting_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Tabla: hosting_services
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hosting_services (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id           UUID           NOT NULL REFERENCES hosting_plans(id),
  domain            TEXT           NOT NULL,
  status            TEXT           NOT NULL DEFAULT 'active',
  monthly_price     NUMERIC(12,2)  NOT NULL,
  setup_date        DATE           NOT NULL,
  next_due_date     DATE           NOT NULL,
  storage_used_gb   NUMERIC(10,2)  NOT NULL DEFAULT 0,
  storage_total_gb  NUMERIC(10,2)  NOT NULL,
  emails_used       INTEGER        NOT NULL DEFAULT 0,
  emails_total      INTEGER,       -- NULL = ilimitados
  hestia_username   TEXT,
  hestia_url        TEXT,
  internal_notes    TEXT,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT hosting_services_status_check CHECK (
    status IN ('active', 'due_soon', 'pending_payment', 'overdue', 'suspended', 'cancelled')
  ),
  CONSTRAINT hosting_services_domain_unique UNIQUE (domain)
);

DROP TRIGGER IF EXISTS trg_hosting_services_updated_at ON hosting_services;
CREATE TRIGGER trg_hosting_services_updated_at
  BEFORE UPDATE ON hosting_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_email        ON clients (email);
CREATE INDEX IF NOT EXISTS idx_clients_status       ON clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_company      ON clients (company);

CREATE INDEX IF NOT EXISTS idx_hosting_plans_status ON hosting_plans (status);

CREATE INDEX IF NOT EXISTS idx_hosting_services_client_id    ON hosting_services (client_id);
CREATE INDEX IF NOT EXISTS idx_hosting_services_plan_id      ON hosting_services (plan_id);
CREATE INDEX IF NOT EXISTS idx_hosting_services_status       ON hosting_services (status);
CREATE INDEX IF NOT EXISTS idx_hosting_services_next_due     ON hosting_services (next_due_date);
CREATE INDEX IF NOT EXISTS idx_hosting_services_domain       ON hosting_services (domain);
