-- Automation Settings (Fase 4E.2)
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_settings_key ON automation_settings(key);
CREATE INDEX IF NOT EXISTS idx_automation_settings_enabled ON automation_settings(enabled);

-- Insert default settings
INSERT INTO automation_settings (key, description, value, enabled)
VALUES
  ('reminder_7_days', 'Send email reminder 7 days before due date', '{"enabled": false, "emailTemplate": "payment_reminder_7d"}', false),
  ('reminder_3_days', 'Send email reminder 3 days before due date', '{"enabled": false, "emailTemplate": "payment_reminder_3d"}', false),
  ('reminder_due_today', 'Send email reminder on due date', '{"enabled": false, "emailTemplate": "payment_reminder_due"}', false),
  ('reminder_overdue_7days', 'Send email reminder 7+ days after due date', '{"enabled": false, "emailTemplate": "payment_reminder_overdue"}', false),
  ('delinquency_create_task', 'Create task when payment is 7+ days overdue', '{"enabled": false, "taskTemplate": "mora_pago"}', false),
  ('hestia_sync_enabled', 'Automatically sync storage usage from HestiaCP daily', '{"enabled": false, "schedule": "02:00"}', false),
  ('notification_recipients_admin', 'Email addresses to notify on critical events', '{"emails": []}', true),
  ('notification_recipients_finance', 'Email addresses for finance notifications', '{"emails": []}', true)
ON CONFLICT (key) DO NOTHING;
