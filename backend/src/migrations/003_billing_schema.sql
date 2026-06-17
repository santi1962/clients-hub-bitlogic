-- ============================================================
-- Migration 003 — Billing schema
-- Tablas: payment_notices, payments
-- ============================================================

-- Secuencia para numeración de avisos
CREATE SEQUENCE IF NOT EXISTS payment_notice_number_seq START 1;

-- ─────────────────────────────────────────
-- Tabla: payment_notices
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_notices (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hosting_service_id  UUID           NOT NULL REFERENCES hosting_services(id) ON DELETE CASCADE,
  notice_number       TEXT           NOT NULL,
  period_month        INTEGER        NOT NULL,
  period_year         INTEGER        NOT NULL,
  issue_date          DATE           NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE           NOT NULL,
  amount              NUMERIC(12,2)  NOT NULL,
  status              TEXT           NOT NULL DEFAULT 'pending',
  sent_at             TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT payment_notices_number_unique    UNIQUE (notice_number),
  CONSTRAINT payment_notices_status_check     CHECK (status IN ('draft','pending','sent','paid','overdue','cancelled'))
);

DROP TRIGGER IF EXISTS trg_payment_notices_updated_at ON payment_notices;
CREATE TRIGGER trg_payment_notices_updated_at
  BEFORE UPDATE ON payment_notices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Tabla: payments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID           NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  hosting_service_id  UUID           REFERENCES hosting_services(id) ON DELETE SET NULL,
  payment_notice_id   UUID,          -- FK añadida abajo (referencia circular)
  period_month        INTEGER        NOT NULL,
  period_year         INTEGER        NOT NULL,
  amount              NUMERIC(12,2)  NOT NULL,
  method              TEXT           NOT NULL DEFAULT 'manual',
  status              TEXT           NOT NULL DEFAULT 'pending',
  paid_at             TIMESTAMPTZ,
  reference           TEXT,
  internal_notes      TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT payments_method_check  CHECK (method  IN ('manual','transfer','cash','mercadopago','paypal')),
  CONSTRAINT payments_status_check  CHECK (status  IN ('pending','paid','overdue','cancelled'))
);

-- FK circular: payments ↔ payment_notices (añadir después de crear ambas tablas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_payment_notice_id_fkey'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_payment_notice_id_fkey
      FOREIGN KEY (payment_notice_id) REFERENCES payment_notices(id) ON DELETE SET NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_notices_client_id    ON payment_notices (client_id);
CREATE INDEX IF NOT EXISTS idx_payment_notices_service_id   ON payment_notices (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_payment_notices_status       ON payment_notices (status);
CREATE INDEX IF NOT EXISTS idx_payment_notices_period       ON payment_notices (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payment_notices_due_date     ON payment_notices (due_date);

CREATE INDEX IF NOT EXISTS idx_payments_client_id           ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_id          ON payments (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_payments_notice_id           ON payments (payment_notice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status              ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_period              ON payments (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at             ON payments (paid_at);
