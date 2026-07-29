// Test de integración REAL contra MariaDB para el dominio clients (Fase
// DB-3B), mismo patrón que auth-mariadb.test.js: ejercita el flujo HTTP
// completo con el driver mysql2 real, porque no alcanza con mocks para
// confirmar que las queries convertidas (placeholders `?`, INSERT/UPDATE+
// SELECT en vez de RETURNING, UUID generado en Node, LOWER()/LIKE en vez de
// ILIKE, COUNT(*) AS count) funcionan contra el motor real.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL. Sin esa variable, el test se salta (no falla). Ver
// docs/MARIADB_MIGRATION.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-clients-flow.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

// Subconjunto de backend/db/schema.sql necesario para este flujo: `users` (lo
// consulta authRequired en cada request) + `clients` (dominio bajo prueba) +
// `hosting_plans`/`hosting_services` (solo para el test de FK — no se ejercita
// ninguna query del dominio hosting, es únicamente para confirmar que la FK
// hosting_services.client_id -> clients.id sigue siendo válida tras el cambio
// de collation/DEFAULT de la Fase DB-3B). Mantener en sync manualmente con
// schema.sql si estas tablas cambian.
const SCHEMA_SQL = `
CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY, name TEXT NOT NULL, email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  phone TEXT, client_id CHAR(36), last_login_at DATETIME,
  notifications JSON NOT NULL DEFAULT '{"emailPayments":true,"emailTickets":true,"whatsapp":false,"weeklyReport":true}',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_role_check CHECK (role IN ('super_admin','admin','soporte','finanzas','cliente')),
  CONSTRAINT users_status_check CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE clients (
  id CHAR(36) NOT NULL PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT NOT NULL,
  phone TEXT, tax_id TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
CREATE INDEX idx_clients_email ON clients (email(191));

CREATE TABLE hosting_plans (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY, name TEXT NOT NULL, storage_gb INT NOT NULL,
  monthly_price DECIMAL(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE hosting_services (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY, client_id CHAR(36) NOT NULL, plan_id CHAR(36) NOT NULL,
  domain VARCHAR(255) NOT NULL, status TEXT NOT NULL DEFAULT 'active', monthly_price DECIMAL(12,2) NOT NULL,
  setup_date DATE NOT NULL, next_due_date DATE NOT NULL,
  storage_used_gb DECIMAL(10,2) NOT NULL DEFAULT 0, storage_total_gb DECIMAL(10,2) NOT NULL,
  emails_used INT NOT NULL DEFAULT 0, emails_total INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT hosting_services_domain_unique UNIQUE (domain),
  CONSTRAINT hosting_services_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT hosting_services_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES hosting_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

-- Solo para el subquery de last_payment_date en clients.service.js listClients
-- (no se ejercita ninguna query del dominio billing acá).
CREATE TABLE payments (
  id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY, client_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'pending', paid_at DATETIME,
  CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
`;

test(
  "clients: flujo completo contra MariaDB real (alta, edición, baja idempotente, búsqueda, FK)",
  { skip: !MARIADB_TEST_URL && "Configurá MARIADB_TEST_URL (MariaDB descartable) para correr esta prueba de integración — ver docs/MARIADB_MIGRATION.md" },
  async (t) => {
    const base = new URL(MARIADB_TEST_URL);
    const dbName = `bitlogic_test_${Date.now()}`;
    const adminConn = await mysql.createConnection({
      host: base.hostname,
      port: base.port || 3306,
      user: decodeURIComponent(base.username || "root"),
      password: decodeURIComponent(base.password || ""),
      multipleStatements: true,
    });

    t.after(async () => {
      await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``).catch(() => {});
      await adminConn.end().catch(() => {});
    });

    await adminConn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
    const scopedConn = await mysql.createConnection({
      host: base.hostname,
      port: base.port || 3306,
      user: decodeURIComponent(base.username || "root"),
      password: decodeURIComponent(base.password || ""),
      database: dbName,
      multipleStatements: true,
    });
    await scopedConn.query(SCHEMA_SQL);
    await scopedConn.end();

    const fixtureDbUrl = `mysql://${base.username || "root"}:${base.password || ""}@${base.hostname}:${base.port || 3306}/${dbName}`;

    const result = spawnSync(process.execPath, [FIXTURE], {
      env: { ...process.env, DATABASE_URL: fixtureDbUrl, NODE_ENV: "test", MARIADB_FIXTURE_RUN: "1" },
      encoding: "utf8",
      timeout: 30_000,
    });

    if (result.status !== 0) {
      console.error("--- stdout del fixture ---\n" + result.stdout);
      console.error("--- stderr del fixture ---\n" + result.stderr);
    }
    assert.equal(result.status, 0, "el fixture de integración MariaDB debe terminar sin errores");
    assert.match(result.stdout, /MARIADB_CLIENTS_FLOW_OK/);
  },
);
