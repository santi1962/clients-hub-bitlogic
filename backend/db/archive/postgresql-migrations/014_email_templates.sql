-- Migration 014 — Email Templates
-- Stores customizable email/message templates

CREATE TABLE IF NOT EXISTS email_templates (
  id         TEXT        PRIMARY KEY, -- e.g. 'venc', 'pago_ok', 'suspendido'
  subject    TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
