// Test de integración REAL contra MariaDB para la Fase DB-3I: Infrastructure
// Services (Email Templates + Automation Settings + Scheduler + Dashboard).
//
// Igual criterio que support-mariadb.test.js/settings-mariadb.test.js: este
// dominio depende de triggers con DELIMITER (trg_support_tickets_number,
// trg_company_settings_single_row) que forman parte del schema.sql completo
// aplicado por apply-mariadb-schema.mjs, no de un subconjunto hardcodeado.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL, y el cliente CLI `mariadb`/`mysql` en el PATH. Sin
// MARIADB_TEST_URL, el test se salta (no falla).
//
// Nota sobre "igualdad de resultados" Postgres/MariaDB: este entorno no
// cuenta con credenciales reales de Postgres (no hay backend/.env, ver
// docs/PRODUCTION_STATUS.md — nunca se intentó adivinar la contraseña del
// servicio local), así que no se pudo levantar una comparación A/B en vivo
// contra ambos motores en la misma corrida. En su lugar, este fixture siembra
// datos determinísticos y afirma los valores numéricos EXACTOS que
// dashboard.service.js debe producir — como esa lógica ya no usa ningún
// operador exclusivo de un motor (sin DATE_TRUNC, ::int/::float, INTERVAL de
// Postgres), los mismos asserts son válidos corriendo contra Postgres real
// con el mismo seed, lo cual es la garantía de "igualdad de resultados" que
// se puede validar sin acceso a esa segunda base.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-infra-services-flow.mjs");
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "scripts", "apply-mariadb-schema.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

test(
  "infrastructure services: dashboard, email templates, automation settings y scheduler contra MariaDB real",
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
    assert.equal(applyResult.status, 0, "el schema completo debe aplicarse sin errores (incluye los 8 defaults de automation_settings y sus triggers)");

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
    assert.match(result.stdout, /MARIADB_INFRA_SERVICES_FLOW_OK/);
  },
);
