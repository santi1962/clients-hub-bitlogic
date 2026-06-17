-- Domains table (Phase 3A)
CREATE TABLE IF NOT EXISTS domains (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  hosting_service_id uuid references hosting_services(id) on delete set null,
  domain text not null unique,
  registrar text,
  registration_date date,
  expiration_date date not null,
  auto_renew boolean default false,
  annual_cost numeric(12,2),
  customer_price numeric(12,2),
  status text not null default 'active' check (status in ('active', 'due_soon', 'expired', 'transferred', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domains_client_id ON domains(client_id);
CREATE INDEX IF NOT EXISTS idx_domains_service_id ON domains(hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_expiration_date ON domains(expiration_date);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER set_domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
