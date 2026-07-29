-- Internal Tasks System (Phase 3C)
-- ============================================================

CREATE TABLE IF NOT EXISTS internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  hosting_service_id uuid REFERENCES hosting_services(id) ON DELETE SET NULL,
  domain_id uuid REFERENCES domains(id) ON DELETE SET NULL,
  support_ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_status ON internal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_priority ON internal_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_assigned_to ON internal_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_due_date ON internal_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_client_id ON internal_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_service_id ON internal_tasks(hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_domain_id ON internal_tasks(domain_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_ticket_id ON internal_tasks(support_ticket_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_created_at ON internal_tasks(created_at DESC);

CREATE OR REPLACE FUNCTION update_internal_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS internal_tasks_updated_at ON internal_tasks;
CREATE TRIGGER internal_tasks_updated_at
BEFORE UPDATE ON internal_tasks
FOR EACH ROW
EXECUTE FUNCTION update_internal_tasks_updated_at();
