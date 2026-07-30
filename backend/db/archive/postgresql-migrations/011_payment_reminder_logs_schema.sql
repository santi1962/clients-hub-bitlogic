-- Payment Reminder Logs (Fase 4E.2)
-- Tracks email reminders to prevent duplicates
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES payment_notices(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  recipient text NOT NULL,
  sent_date date NOT NULL DEFAULT CURRENT_DATE,
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_reminder_logs_unique
ON payment_reminder_logs(notice_id, reminder_type, sent_date);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_notice_id ON payment_reminder_logs(notice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_type ON payment_reminder_logs(reminder_type);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_sent_at ON payment_reminder_logs(sent_at DESC);
