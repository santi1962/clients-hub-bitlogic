// Test de integración REAL contra MariaDB para el dominio Support/Tickets
// (Fase DB-3F).
//
// A diferencia de clients-mariadb.test.js/hosting-mariadb.test.js/etc (que
// arman un subconjunto de tablas a mano vía mysql2 multipleStatements), este
// dominio depende del trigger trg_support_tickets_number (con DELIMITER,
// cuerpo multi-sentencia) para generar ticket_number — y DELIMITER no es SQL
// real, no se puede mandar vía mysql2 (ver docs/MARIADB_MIGRATION.md,
// sección "Runner reproducible del schema"). Por eso este test aplica el
// schema.sql COMPLETO con el runner oficial (apply-mariadb-schema.mjs, vía
// el cliente CLI mariadb/mysql) en vez de un subconjunto hardcodeado — es la
// única forma de ejercitar el trigger real.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL, y el cliente CLI `mariadb`/`mysql` en el PATH (lo mismo
// que ya exige apply-mariadb-schema.mjs). Sin MARIADB_TEST_URL, el test se
// salta (no falla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-support-flow.mjs");
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "scripts", "apply-mariadb-schema.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

test(
  "support/tickets: flujo completo contra MariaDB real (tickets, mensajes, adjuntos, trigger de ticket_number, FKs, auditoría)",
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
    assert.equal(applyResult.status, 0, "el schema completo debe aplicarse sin errores (incluye el trigger de ticket_number)");

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
    assert.match(result.stdout, /MARIADB_SUPPORT_FLOW_OK/);
  },
);
