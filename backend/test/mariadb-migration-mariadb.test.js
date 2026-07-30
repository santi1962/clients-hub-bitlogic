// Test de integración REAL contra MariaDB para el migrador de datos reales
// (Fase DB-4A): rollback de lote, rechazo de duplicados, checksum
// corrupto, y formatVersion de manifest no soportado. Usa fixtures
// sintéticos mínimos armados a mano en este mismo archivo — NUNCA datos
// reales, ver "No incluir datos reales en fixtures" (Sección 10).
//
// Requiere una MariaDB DESCARTABLE ya corriendo, señalada por
// MARIADB_TEST_URL, y el cliente CLI `mariadb`/`mysql` en el PATH (lo
// mismo que ya exigen los demás *-mariadb.test.js del proyecto). Sin
// MARIADB_TEST_URL, el test se salta (no falla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { TABLE_ORDER } from "../scripts/mariadb-migration/table-order.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_SCRIPT = path.join(__dirname, "..", "scripts", "mariadb-migration", "import-mariadb.mjs");
const MARIADB_TEST_URL = process.env.MARIADB_TEST_URL;

// import-mariadb.mjs exige una entrada de manifest para las 20 tablas de
// TABLE_ORDER (mismo chequeo que protege un export real incompleto) — el
// fixture arma `users`/`clients` con datos reales del test y el resto de
// las 18 tablas restantes vacías, para no tener que levantar las 20 a mano.
function buildManifest(usersRows, clientsRows) {
  const usersLines = usersRows.map((r) => JSON.stringify(r));
  const clientsLines = clientsRows.map((r) => JSON.stringify(r));
  const tables = {};
  for (const table of TABLE_ORDER) {
    if (table === "users") {
      tables.users = {
        rowCount: usersRows.length,
        file: "users.ndjson",
        sha256: sha256(usersLines.join("\n")),
        columns: ["id", "name", "email", "password_hash", "role", "status"],
      };
    } else if (table === "clients") {
      tables.clients = {
        rowCount: clientsRows.length,
        file: "clients.ndjson",
        sha256: sha256(clientsLines.join("\n")),
        columns: ["id", "name", "email", "status"],
      };
    } else {
      tables[table] = { rowCount: 0, file: `${table}.ndjson`, sha256: sha256(""), columns: ["id"] };
    }
  }
  return {
    manifest: {
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      timezone: "UTC",
      sourceEngine: "postgresql",
      sourceVersion: "PostgreSQL 18.3 (fixture sintético)",
      sourceDescribed: "postgresql://fixture/fixture",
      appCommit: null,
      tableOrder: TABLE_ORDER,
      tables,
    },
    usersLines,
    clientsLines,
  };
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function writeExport(dir, { manifest, usersLines, clientsLines }) {
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(dir, "users.ndjson"), usersLines.length ? usersLines.join("\n") + "\n" : "");
  writeFileSync(path.join(dir, "clients.ndjson"), clientsLines.length ? clientsLines.join("\n") + "\n" : "");
  for (const table of TABLE_ORDER) {
    if (table === "users" || table === "clients") continue;
    writeFileSync(path.join(dir, `${table}.ndjson`), "");
  }
}

test(
  "migrador de datos: rollback de lote, duplicados, checksum y manifest inválido contra MariaDB real",
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

    const exportDir = mkdtempSync(path.join(tmpdir(), "bitlogic-migration-fixture-"));
    t.after(() => rmSync(exportDir, { recursive: true, force: true }));

    // ── 1. Manifest formatVersion no soportado -> rechazado sin tocar nada ──
    {
      const data = buildManifest([], []);
      data.manifest.formatVersion = 999;
      writeExport(exportDir, data);
      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl, "--export-dir", exportDir], { encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /formatVersion/);
    }

    // ── 2. Import real válido (2 usuarios, 2 clientes) ──
    const validUsers = [
      { id: randomUUID(), name: "Admin Fixture", email: "admin@fixture.test", password_hash: "hash1", role: "super_admin", status: "active" },
    ];
    const validClients = [
      { id: randomUUID(), name: "Cliente Fixture", email: "cliente@fixture.test", status: "active" },
    ];
    {
      const data = buildManifest(validUsers, validClients);
      writeExport(exportDir, data);
      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl, "--export-dir", exportDir], { encoding: "utf8" });
      if (result.status !== 0) console.error(result.stdout, result.stderr);
      assert.equal(result.status, 0);
    }

    // ── 3. Reimportar sin --force sobre un destino con datos -> rechazado ──
    {
      const data = buildManifest(validUsers, validClients);
      writeExport(exportDir, data);
      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl, "--export-dir", exportDir], { encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /ya tiene/);
    }

    // ── 4. Reimportar CON --force pero mismo id (duplicado real) -> aborta, no usa INSERT IGNORE ──
    {
      const data = buildManifest(validUsers, []);
      writeExport(exportDir, data);
      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl, "--export-dir", exportDir, "--force"], { encoding: "utf8" });
      assert.notEqual(result.status, 0, "un duplicado real debe abortar, incluso con --force");
      assert.match(result.stdout + result.stderr, /Duplicate|duplicate/i);

      const [rows] = await adminConn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.users`);
      assert.equal(Number(rows[0].c), 1, "el duplicado rechazado no debe dejar una fila extra ni corromper la tabla");
    }

    // ── 5. Checksum corrupto (archivo editado a mano) -> rechazado, nada se escribe ──
    {
      const dbName2 = `bitlogic_test_${Date.now()}_b`;
      await adminConn.query(`CREATE DATABASE \`${dbName2}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
      t.after(() => adminConn.query(`DROP DATABASE IF EXISTS \`${dbName2}\``).catch(() => {}));
      const dbUrl2 = `mysql://${base.username || "root"}:${base.password || ""}@${base.hostname}:${base.port || 3306}/${dbName2}`;

      const data = buildManifest(validUsers, validClients);
      writeExport(exportDir, data);
      // corromper el NDJSON sin actualizar el checksum del manifest
      writeFileSync(path.join(exportDir, "users.ndjson"), data.usersLines.join("\n") + "\nlinea-agregada-a-mano\n");

      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl2, "--export-dir", exportDir], { encoding: "utf8" });
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /checksum/i);

      const [rows] = await adminConn.query(`SELECT COUNT(*) AS c FROM \`${dbName2}\`.users`);
      assert.equal(Number(rows[0].c), 0, "un checksum corrupto no debe insertar ninguna fila");
    }

    // ── 6. Rollback de lote: una fila que viola un CHECK real (role fuera
    // del enum) a mitad de tabla no debe dejar filas parciales — un id mal
    // formado NO sirve para este caso: CHAR(36) no valida formato UUID a
    // nivel de motor, así que no dispara ningún error real ──
    {
      const dbName3 = `bitlogic_test_${Date.now()}_c`;
      await adminConn.query(`CREATE DATABASE \`${dbName3}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
      t.after(() => adminConn.query(`DROP DATABASE IF EXISTS \`${dbName3}\``).catch(() => {}));
      const dbUrl3 = `mysql://${base.username || "root"}:${base.password || ""}@${base.hostname}:${base.port || 3306}/${dbName3}`;

      const okUser = { id: randomUUID(), name: "User OK", email: "ok-user@fixture.test", password_hash: "hash", role: "admin", status: "active" };
      const badUser = { id: randomUUID(), name: "User Malo", email: "malo-user@fixture.test", password_hash: "hash", role: "rol_que_no_existe", status: "active" };
      const data = buildManifest([okUser, badUser], []);
      writeExport(exportDir, data);

      const result = spawnSync(process.execPath, [IMPORT_SCRIPT, "--url", dbUrl3, "--export-dir", exportDir], { encoding: "utf8" });
      assert.notEqual(result.status, 0);

      const [rows] = await adminConn.query(`SELECT COUNT(*) AS c FROM \`${dbName3}\`.users`);
      assert.equal(Number(rows[0].c), 0, "el ROLLBACK debe dejar la tabla en 0 filas, ni siquiera la fila válida del mismo lote debe quedar insertada");
    }

    console.log("MARIADB_MIGRATION_TOOL_TESTS_OK");
  },
);
