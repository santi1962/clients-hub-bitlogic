-- ============================================================
-- Migration 012 — Company Settings
-- Tabla para guardar configuración de la empresa
-- Debe haber solo una fila (empresa principal)
-- ============================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT          NOT NULL,
  contact_email     TEXT,
  phone             TEXT,
  tax_id            TEXT,
  address           TEXT,
  currency          TEXT          NOT NULL DEFAULT 'ARS',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT company_settings_currency_check CHECK (currency IN ('ARS', 'USD', 'EUR'))
);

-- Ensure only one row (para la empresa principal)
CREATE OR REPLACE FUNCTION enforce_single_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM company_settings) >= 1 AND NEW.id NOT IN (SELECT id FROM company_settings) THEN
    RAISE EXCEPTION 'Solo se permite una configuracion de empresa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_company_settings ON company_settings;
CREATE TRIGGER trg_single_company_settings
  BEFORE INSERT ON company_settings
  FOR EACH ROW EXECUTE FUNCTION enforce_single_company_settings();

-- Actualización automática de updated_at
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
