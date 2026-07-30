// Test de integración REAL contra MariaDB para la Fase DB-3J: Billing
// (payment_notices, payments, resúmenes, MercadoPago en la capa de
// persistencia).
//
// Igual criterio que support/settings/infra-services-mariadb.test.js: aplica
// el schema.sql COMPLETO vía apply-mariadb-schema.mjs (CLI mariadb/mysql, no
// mysql2) antes de correr su fixture.
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
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-billing-flow.mjs");
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "scripts", "apply-mariadb-schema.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

test(
  "billing: avisos, pagos, resúmenes (MRR/deuda/revenue) y FKs/UUID contra MariaDB real",
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
    assert.equal(applyResult.status, 0, "el schema completo debe aplicarse sin errores");

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
    assert.match(result.stdout, /MARIADB_BILLING_FLOW_OK/);
  },
);
