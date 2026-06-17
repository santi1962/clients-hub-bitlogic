-- Scheduler Logs (Fase 4E)
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduler_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_job_name ON scheduler_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_status ON scheduler_logs(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_created_at ON scheduler_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_job_created ON scheduler_logs(job_name, created_at DESC);
