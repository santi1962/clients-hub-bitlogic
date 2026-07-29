// Test de integración REAL contra MariaDB para el subsistema audit_logs
// (Fase DB-3D), mismo patrón que clients-mariadb.test.js/hosting-mariadb.test.js:
// ejercita el flujo HTTP completo con el driver mysql2 real, y confirma que
// el "punto ciego de auditoría" (acciones sobre clients/plans/hosting_services
// que no quedaban registradas contra MariaDB, documentado en DB-3B/DB-3C)
// desapareció.
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
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-audit-flow.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

// Subconjunto de backend/db/schema.sql: users (FK de audit_logs + authRequired),
// clients/hosting_plans/hosting_services (para generar audit_logs reales vía
// sus flujos ya convertidos) y audit_logs (dominio bajo prueba).
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

CREATE TABLE hosting_plans (
  id CHAR(36) NOT NULL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  storage_gb INT NOT NULL, websites_limit INT, emails_limit INT,
  monthly_price DECIMAL(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT hosting_plans_status_check CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE hosting_services (
  id CHAR(36) NOT NULL PRIMARY KEY, client_id CHAR(36) NOT NULL, plan_id CHAR(36) NOT NULL,
  domain VARCHAR(255) NOT NULL, status TEXT NOT NULL DEFAULT 'active', monthly_price DECIMAL(12,2) NOT NULL,
  setup_date DATE NOT NULL, next_due_date DATE NOT NULL,
  storage_used_gb DECIMAL(10,2) NOT NULL DEFAULT 0, storage_total_gb DECIMAL(10,2) NOT NULL,
  emails_used INT NOT NULL DEFAULT 0, emails_total INT,
  hestia_username TEXT, hestia_url TEXT, internal_notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT hosting_services_domain_unique UNIQUE (domain),
  CONSTRAINT hosting_services_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT hosting_services_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES hosting_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  old_values JSON,
  new_values JSON,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;
`;

test(
  "audit_logs: flujo completo contra MariaDB real (alta/edición/baja auditadas, filtros, paginación, JSON, FK de usuario eliminado)",
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
    assert.match(result.stdout, /MARIADB_AUDIT_FLOW_OK/);
  },
);
