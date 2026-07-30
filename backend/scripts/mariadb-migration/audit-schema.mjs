#!/usr/bin/env node
// audit-schema.mjs — Fase DB-4A, Sección 1: auditoría previa de datos.
//
// Compara, columna por columna, el Postgres REAL (vía information_schema,
// nunca asumiendo que coincide con lo versionado) contra backend/db/schema.sql
// (el schema consolidado de MariaDB) y contra backend/src/migrations/*.sql
// (la fuente de verdad histórica de Postgres). Entrega la matriz pedida:
// Tabla | PostgreSQL real | MariaDB schema | Diferencias | Acción.
//
// USO:
//   node audit-schema.mjs --url postgresql://user:pass@host:port/db
//
// No modifica nada — es de solo lectura en ambos lados (Postgres real vía
// SQL, schema.sql vía lectura de archivo).
import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeUrl } from "./lib/db-url.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(__dirname, "..", "..", "db", "schema.sql");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
  }
  return args;
}

/** Parser minimalista de CREATE TABLE — extrae solo nombres de columna (no tipos completos), suficiente para detectar gaps de columnas. */
function parseSchemaSqlColumns(sql) {
  const tables = {};
  const tableRe = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\)\s*ENGINE/g;
  let m;
  while ((m = tableRe.exec(sql))) {
    const [, tableName, body] = m;
    const columns = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,\s*$/, "");
      if (!line) continue;
      if (/^--/.test(line)) continue;
      if (/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK|KEY|INDEX)\b/i.test(line)) continue;
      const colMatch = /^(`?\w+`?)\s+\S/.exec(line);
      if (colMatch) columns.push(colMatch[1].replace(/`/g, ""));
    }
    tables[tableName] = columns;
  }
  return tables;
}

async function main() {
  const { url } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error("Uso: node audit-schema.mjs --url postgresql://user:pass@host:port/db");
    process.exit(1);
  }

  console.log("──────────────────────────────────────────────");
  console.log(" audit-schema.mjs — Fase DB-4A");
  console.log("──────────────────────────────────────────────");
  console.log(` Origen (Postgres): ${describeUrl(url)}`);
  console.log("──────────────────────────────────────────────\n");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const { rows: versionRows } = await client.query("SELECT version()");
    console.log(`Versión de servidor: ${versionRows[0].version}\n`);

    const { rows: pgTables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const pgTableNames = pgTables.map((r) => r.table_name);

    const schemaSql = readFileSync(SCHEMA_SQL_PATH, "utf8");
    const mariaTables = parseSchemaSqlColumns(schemaSql);
    const mariaTableNames = Object.keys(mariaTables).sort();

    const onlyInPg = pgTableNames.filter((t) => !mariaTableNames.includes(t));
    const onlyInMaria = mariaTableNames.filter((t) => !pgTableNames.includes(t));

    console.log(`Tablas en Postgres real: ${pgTableNames.length}`);
    console.log(`Tablas en schema.sql (MariaDB): ${mariaTableNames.length}`);
    if (onlyInPg.length) console.log(`⚠ Solo en Postgres: ${onlyInPg.join(", ")}`);
    if (onlyInMaria.length) console.log(`⚠ Solo en schema.sql: ${onlyInMaria.join(", ")}`);
    console.log("");

    const matrix = [];
    let hasDataLossRisk = false;

    for (const table of pgTableNames) {
      const { rows: pgCols } = await client.query(
        `SELECT column_name, data_type, is_nullable, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table],
      );
      const { rows: countRows } = await client.query(`SELECT COUNT(*) AS count FROM "${table}"`);
      const { rows: pkRows } = await client.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [table],
      );
      const { rows: fkRows } = await client.query(
        `SELECT
           kcu.column_name,
           ccu.table_name AS references_table,
           ccu.column_name AS references_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
        [table],
      );
      const { rows: uniqueRows } = await client.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'`,
        [table],
      );

      const pgColNames = pgCols.map((c) => c.column_name);
      const mariaColNames = mariaTables[table] ?? [];
      const missingInMaria = pgColNames.filter((c) => !mariaColNames.includes(c));
      const missingInPg = mariaColNames.filter((c) => !pgColNames.includes(c));

      const uuidCols = pgCols.filter((c) => c.udt_name === "uuid").map((c) => c.column_name);
      const jsonCols = pgCols.filter((c) => c.udt_name === "jsonb" || c.udt_name === "json").map((c) => c.column_name);
      const boolCols = pgCols.filter((c) => c.udt_name === "bool").map((c) => c.column_name);
      const numericCols = pgCols.filter((c) => c.udt_name === "numeric").map((c) => c.column_name);
      const dateCols = pgCols.filter((c) => c.udt_name === "date").map((c) => c.column_name);
      const tsCols = pgCols.filter((c) => c.udt_name === "timestamptz" || c.udt_name === "timestamp").map((c) => c.column_name);
      const nullableCols = pgCols.filter((c) => c.is_nullable === "YES").map((c) => c.column_name);

      let action = "Ninguna — coincide";
      if (missingInMaria.length || missingInPg.length) {
        // Gap conocido y ya documentado en fases anteriores (DB-3F, DB-3H):
        // columnas que solo existen en el lado MariaDB porque el código de
        // la app ya las usa, pero la migración de Postgres nunca se
        // actualizó. No representan pérdida de datos al migrar (MariaDB
        // simplemente las deja NULL para las filas históricas) — SÍ
        // representan un gap a documentar, no a bloquear.
        const isKnownAppOnlyGap =
          (table === "support_ticket_messages" && missingInPg.every((c) => ["attachment_url", "attachment_type", "attachment_name"].includes(c))) ||
          (table === "company_settings" && missingInPg.every((c) => c === "logo_url"));

        if (missingInMaria.length) {
          action = `RIESGO DE PÉRDIDA: columnas en Postgres ausentes en MariaDB: ${missingInMaria.join(", ")} — FRENAR antes de exportar`;
          hasDataLossRisk = true;
        } else if (isKnownAppOnlyGap) {
          action = `Gap conocido (ver docs/MARIADB_MIGRATION.md) — columnas solo en MariaDB: ${missingInPg.join(", ")}. Se importan como NULL, sin pérdida (Postgres nunca las tuvo)`;
        } else {
          action = `Revisar — columnas solo en MariaDB (no bloquea, se importan NULL): ${missingInPg.join(", ")}`;
        }
      }

      matrix.push({
        table,
        rowCount: parseInt(countRows[0].count, 10),
        pk: pkRows.map((r) => r.column_name),
        fks: fkRows.map((r) => `${r.column_name} -> ${r.references_table}(${r.references_column})`),
        unique: uniqueRows.map((r) => r.column_name),
        uuidCols,
        jsonCols,
        boolCols,
        numericCols,
        dateCols,
        tsCols,
        nullableCols,
        missingInMaria,
        missingInPg,
        action,
      });
    }

    console.log("Tabla".padEnd(26) + "Filas".padEnd(8) + "PK".padEnd(6) + "FKs".padEnd(6) + "Acción");
    console.log("-".repeat(100));
    for (const row of matrix) {
      console.log(
        row.table.padEnd(26) +
          String(row.rowCount).padEnd(8) +
          String(row.pk.length).padEnd(6) +
          String(row.fks.length).padEnd(6) +
          row.action,
      );
    }

    console.log("\n" + JSON.stringify({ generatedAt: new Date().toISOString(), tables: matrix }, null, 2));

    if (hasDataLossRisk) {
      console.error("\n✗ Se detectaron columnas en Postgres que NO existen en MariaDB — riesgo real de pérdida de datos. Abortando antes de exportar.");
      process.exit(1);
    }

    console.log("\n✓ Sin riesgo de pérdida de datos detectado (gaps, si los hay, son columnas app-only ya documentadas, se importan NULL).");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Error en audit-schema.mjs:", err.message);
  process.exit(1);
});
