-- Migration 013 — Add notifications column to users
-- Idempotent: uses ADD COLUMN IF NOT EXISTS

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notifications JSONB NOT NULL DEFAULT '{"emailPayments":true,"emailTickets":true,"whatsapp":false,"weeklyReport":true}';
