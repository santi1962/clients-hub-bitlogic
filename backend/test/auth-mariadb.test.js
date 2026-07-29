// Test de integración REAL contra MariaDB para el dominio auth/users (Fase
// DB-3A). A diferencia del resto de la suite (mockeada a nivel pool.query,
// ver helpers/pool-mock.js), esto ejercita el flujo HTTP completo con el
// driver mysql2 real — porque "no basta con mocks" para confirmar que las
// queries convertidas (placeholders `?`, INSERT/UPDATE+SELECT en vez de
// RETURNING, normalización de errores) funcionan contra el motor real.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por la variable de
// entorno MARIADB_TEST_URL (ej. "mysql://root:@127.0.0.1:13309/ignorado" —
// el nombre de base en la URL no importa, este test crea y borra su propia
// base temporal). Sin esa variable, el test se salta (no falla) para no
// romper `npm test` en un entorno sin MariaDB disponible. Ver
// docs/MARIADB_MIGRATION.md para cómo levantar una instancia descartable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-auth-flow.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

// Mismas 4 tablas del dominio auth/users que backend/db/schema.sql — SIN los
// triggers de otros dominios (ticket_number, company_settings), que no hacen
// falta acá y que además requieren DELIMITER (no ejecutable vía mysql2,
// documentado en el propio schema.sql). Mantener en sync manualmente con
// schema.sql si esas 4 tablas cambian.
const SCHEMA_SQL = `
CREATE TABLE clients (
  id CHAR(36) NOT NULL PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT NOT NULL,
  phone TEXT, tax_id TEXT, status TEXT NOT NULL DEFAULT 'active', notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY, user_id CHAR(36) NOT NULL, token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL, revoked_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY, user_id CHAR(36) NOT NULL, token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL, used_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

test(
  "auth/users: flujo completo contra MariaDB real (login, refresh, reset, CRUD, roles, JSON)",
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

    await adminConn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
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
    assert.match(result.stdout, /MARIADB_AUTH_FLOW_OK/);
  },
);
