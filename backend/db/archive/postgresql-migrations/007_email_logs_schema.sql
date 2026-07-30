-- Email Logs (Phase 4B)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  related_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  related_notice_id uuid REFERENCES payment_notices(id) ON DELETE SET NULL,
  related_ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  related_domain_id uuid REFERENCES domains(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(related_client_id);
