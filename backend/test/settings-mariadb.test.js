// Test de integración REAL contra MariaDB para el dominio Settings (Fase
// DB-3H).
//
// Igual que support-mariadb.test.js: company_settings depende del trigger
// trg_company_settings_single_row (DELIMITER, cuerpo multi-sentencia), no
// ejecutable vía mysql2 multipleStatements — se aplica el schema.sql
// COMPLETO con el runner oficial (apply-mariadb-schema.mjs, vía CLI) en vez
// de un subconjunto hardcodeado, para poder ejercitar el trigger real.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL, y el cliente CLI `mariadb`/`mysql` en el PATH. Sin
// MARIADB_TEST_URL, el test se salta (no falla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-settings-flow.mjs");
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "scripts", "apply-mariadb-schema.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

test(
  "settings: flujo completo contra MariaDB real (company_settings, trigger de fila única, logo, readiness, auditoría)",
  { skip: !MARIADB_TEST_URL && "Configurá MARIADB_TEST_URL (MariaDB descartable) para correr esta prueba de integración — ver docs/MARIADB_MIGRATION.md" },
  async (t) => {
    const base = new URL(MARIADB_TEST_URL);
    const dbName = `bitlogic_test_${Date.now()}`;
    const adminConn = await mysql.createConnection({
      host: base.hostname,
      port: base.port || 3306,
      user: decodeURIComponent(base.username || "root"),
      password: decodeURIComponent(base.password || ""),
    });

    t.after(async () => {
      await adminConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``).catch(() => {});
      await adminConn.end().catch(() => {});
    });

    await adminConn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);

    const dbUrl = `mysql://${base.username || "root"}:${base.password || ""}@${base.hostname}:${base.port || 3306}/${dbName}`;

    const applyResult = spawnSync(process.execPath, [APPLY_SCHEMA_SCRIPT, "--url", dbUrl], {
      encoding: "utf8",
      timeout: 30_000,
    });
    if (applyResult.status !== 0) {
      console.error("--- stdout de apply-mariadb-schema.mjs ---\n" + applyResult.stdout);
      console.error("--- stderr de apply-mariadb-schema.mjs ---\n" + applyResult.stderr);
    }
    assert.equal(applyResult.status, 0, "el schema completo debe aplicarse sin errores (incluye el trigger de fila única de company_settings)");

    const result = spawnSync(process.execPath, [FIXTURE], {
      env: { ...process.env, DATABASE_URL: dbUrl, NODE_ENV: "test", MARIADB_FIXTURE_RUN: "1" },
      encoding: "utf8",
      timeout: 30_000,
    });

    if (result.status !== 0) {
      console.error("--- stdout del fixture ---\n" + result.stdout);
      console.error("--- stderr del fixture ---\n" + result.stderr);
    }
    assert.equal(result.status, 0, "el fixture de integración MariaDB debe terminar sin errores");
    assert.match(result.stdout, /MARIADB_SETTINGS_FLOW_OK/);
  },
);
