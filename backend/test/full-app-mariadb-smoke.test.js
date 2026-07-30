// Test de integración REAL contra MariaDB para la Fase DB-3K: prueba de
// aplicación completa. A diferencia de todos los demás *-mariadb.test.js
// (que ejercitan un dominio a la vez importando app.js EN PROCESO), este
// arranca `src/server.js` como un proceso de sistema operativo real —
// confirma que el backend completo arranca, pasa readiness, registra el
// scheduler (sin auto-ejecutar, SCHEDULER_ENABLED=false), levanta Socket.IO,
// atiende todas las familias de rutas principales, corre un backup real con
// mariadb-dump/mysqldump, y se apaga ordenadamente ante SIGTERM — contra
// MariaDB real, no un mock.
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL, y el cliente CLI `mariadb`/`mysql` en el PATH (además de
// `mariadb-dump`/`mysqldump` para el paso de backups). Sin MARIADB_TEST_URL,
// el test se salta (no falla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-full-app-smoke.mjs");
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "scripts", "apply-mariadb-schema.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

test(
  "aplicación completa: arranque, readiness, Socket.IO, todas las familias de rutas, backup real y apagado ordenado contra MariaDB real",
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
      timeout: 60_000,
    });

    if (result.status !== 0) {
      console.error("--- stdout del fixture ---\n" + result.stdout);
      console.error("--- stderr del fixture ---\n" + result.stderr);
    }
    assert.equal(result.status, 0, "el smoke test de aplicación completa debe terminar sin errores");
    assert.match(result.stdout, /MARIADB_FULL_APP_SMOKE_HTTP_OK/);
    assert.match(result.stdout, /MARIADB_FULL_APP_SMOKE_OK/);
  },
);
