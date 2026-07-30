#!/usr/bin/env node
// import-mariadb.mjs — Fase DB-4A, Sección 6: importación del formato
// intermedio (NDJSON + manifest.json) a una MariaDB limpia.
//
// USO:
//   node import-mariadb.mjs --url mysql://user:pass@host:port/db --export-dir <ruta> [--force] [--dry-run] [--skip-schema]
//
// Requiere que la MariaDB destino esté VACÍA (sin filas en ninguna tabla)
// salvo que se pase --force explícito. Aplica backend/db/schema.sql con el
// runner ya existente (apply-mariadb-schema.mjs) antes de importar, salvo
// --skip-schema (para cuando el schema ya se aplicó a mano).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import { TABLE_ORDER, PRIMARY_KEY, BUSINESS_SEQUENCES } from "./table-order.js";
import { sha256Hex } from "./lib/transform.js";
import { describeUrl, assertNotProductionDatabaseUrl, sameTarget } from "./lib/db-url.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY_SCHEMA_SCRIPT = path.join(__dirname, "..", "apply-mariadb-schema.mjs");
const BATCH_SIZE = 500;
const CURRENT_FORMAT_VERSION = 1;

function parseArgs(argv) {
  const args = { force: false, dryRun: false, skipSchema: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    if (argv[i] === "--export-dir") args.exportDir = argv[++i];
    if (argv[i] === "--force") args.force = true;
    if (argv[i] === "--dry-run") args.dryRun = true;
    if (argv[i] === "--skip-schema") args.skipSchema = true;
  }
  return args;
}

/** DATETIME de MariaDB no acepta el string ISO con sufijo 'Z' de forma consistente en todos los drivers/versiones — se convierte a Date real, mismo patrón que el resto de la aplicación (ver docs/MARIADB_MIGRATION.md, "Fechas — política UTC"). */
function reviveValue(value, columnName) {
  if (value === null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return new Date(value);
  }
  return value;
}

async function main() {
  const { url, exportDir, force, dryRun, skipSchema } = parseArgs(process.argv.slice(2));
  if (!url || !exportDir) {
    console.error("Uso: node import-mariadb.mjs --url mysql://user:pass@host:port/db --export-dir <ruta> [--force] [--dry-run] [--skip-schema]");
    process.exit(1);
  }
  assertNotProductionDatabaseUrl(url, "import-mariadb.mjs");
  if (!url.startsWith("mysql://") && !url.startsWith("mysql2://")) {
    console.error("La URL de destino debe ser mysql:// (MariaDB) — este script nunca escribe en Postgres.");
    process.exit(1);
  }

  const manifestPath = path.join(exportDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`No se encontró manifest.json en ${exportDir} — ¿corriste export-postgres.mjs primero?`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.formatVersion !== CURRENT_FORMAT_VERSION) {
    console.error(`manifest.json tiene formatVersion=${manifest.formatVersion}, este importador solo entiende formatVersion=${CURRENT_FORMAT_VERSION}.`);
    process.exit(1);
  }
  if (manifest.collisions?.length && !force) {
    console.error("El manifest fue generado con colisiones case-insensitive sin resolver (--allow-collisions en el export) — no se importa sin --force explícito, ya que rompería UNIQUE en MariaDB.");
    process.exit(1);
  }

  console.log("──────────────────────────────────────────────");
  console.log(" import-mariadb.mjs — Fase DB-4A");
  console.log("──────────────────────────────────────────────");
  console.log(` Destino:     ${describeUrl(url)}`);
  console.log(` Export dir:  ${exportDir}`);
  console.log(` Origen orig: ${manifest.sourceDescribed} (${manifest.sourceVersion?.split(",")[0]})`);
  console.log(` Generado:    ${manifest.generatedAt}`);
  console.log(` dry-run:     ${dryRun ? "sí" : "no"}`);
  console.log("──────────────────────────────────────────────\n");

  if (!skipSchema) {
    console.log("Aplicando backend/db/schema.sql (apply-mariadb-schema.mjs)…");
    const result = spawnSync(process.execPath, [APPLY_SCHEMA_SCRIPT, "--url", url], { encoding: "utf8" });
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
      console.error("✗ No se pudo aplicar el schema — abortando antes de tocar datos.");
      process.exit(1);
    }
    console.log("✓ Schema aplicado.\n");
  }

  const pool = await mysql.createConnection({ uri: url, timezone: "Z" });

  try {
    // ── automation_settings es la ÚNICA tabla con datos propios de
    // schema.sql (el `INSERT IGNORE` de 8 defaults que corre al aplicar el
    // schema, ver db/schema.sql) — no son "datos del destino" en el sentido
    // que esta guarda intenta proteger (no hay usuario que los haya
    // cargado), son placeholders de configuración que la migración real
    // debe reemplazar por los valores históricos reales. Se vacía ANTES del
    // chequeo de "destino vacío" para no confundir un estado esperado del
    // schema con datos reales preexistentes, y para que el INSERT de la
    // fila histórica no choque contra el UNIQUE(key) de los defaults.
    if (!skipSchema) {
      const [existing] = await pool.query("SELECT COUNT(*) AS c FROM automation_settings");
      if (Number(existing[0].c) > 0) {
        await pool.query("DELETE FROM automation_settings");
        console.log("✓ automation_settings: se vaciaron los 8 defaults sembrados por schema.sql (se reemplazan por los valores históricos reales a continuación).\n");
      }
    }

    // ── Rechazar destino con datos, salvo --force ──
    if (!force) {
      for (const table of TABLE_ORDER) {
        const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
        if (Number(rows[0].c) > 0) {
          console.error(`✗ La tabla "${table}" en el destino ya tiene ${rows[0].c} fila(s). Este importador nunca escribe sobre una MariaDB con datos salvo --force explícito (y aun así no usa INSERT IGNORE — un duplicado real sigue abortando).`);
          process.exit(1);
        }
      }
      console.log("✓ Destino vacío confirmado (las 20 tablas en 0 filas).\n");
    } else {
      console.log("⚠ --force: se omite el chequeo de destino vacío.\n");
    }

    if (dryRun) {
      console.log("dry-run: validando manifest y archivos NDJSON sin escribir nada…\n");
      for (const table of TABLE_ORDER) {
        const meta = manifest.tables[table];
        if (!meta) throw new Error(`manifest.json no tiene entrada para la tabla "${table}"`);
        const filePath = path.join(exportDir, meta.file);
        if (!existsSync(filePath)) throw new Error(`Falta el archivo ${meta.file} referenciado en el manifest`);
        const content = readFileSync(filePath, "utf8");
        const lines = content ? content.trimEnd().split("\n") : [];
        const checksum = sha256Hex(lines.join("\n"));
        if (checksum !== meta.sha256) throw new Error(`Checksum no coincide para ${table}: manifest dice ${meta.sha256}, archivo real da ${checksum}`);
        if (lines.length !== meta.rowCount) throw new Error(`${table}: manifest dice ${meta.rowCount} filas, el archivo tiene ${lines.length}`);
        console.log(`  ✓ ${table.padEnd(26)} ${String(lines.length).padStart(6)} filas — checksum OK`);
      }
      console.log("\n✓ dry-run completo, todo consistente. No se escribió nada en el destino.");
      return;
    }

    const importedCounts = {};

    for (const table of TABLE_ORDER) {
      const meta = manifest.tables[table];
      if (!meta) throw new Error(`manifest.json no tiene entrada para la tabla "${table}" — abortando, no continuar silenciosamente`);
      const filePath = path.join(exportDir, meta.file);
      const content = readFileSync(filePath, "utf8");
      const lines = content ? content.trimEnd().split("\n").filter(Boolean) : [];

      const checksum = sha256Hex(lines.join("\n"));
      if (checksum !== meta.sha256) {
        throw new Error(`${table}: checksum no coincide (manifest=${meta.sha256}, archivo=${checksum}) — el archivo pudo corromperse o editarse a mano. Abortando.`);
      }

      const columns = meta.columns;
      const placeholders = `(${columns.map(() => "?").join(",")})`;
      const insertSql = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(",")}) VALUES `;

      try {
        await pool.query("BEGIN");
        let inserted = 0;
        for (let i = 0; i < lines.length; i += BATCH_SIZE) {
          const batchLines = lines.slice(i, i + BATCH_SIZE);
          const batchRows = batchLines.map((line) => JSON.parse(line));
          const params = [];
          for (const row of batchRows) {
            for (const col of columns) params.push(reviveValue(row[col], col));
          }
          const valuesSql = batchRows.map(() => placeholders).join(",");
          try {
            await pool.query(insertSql + valuesSql, params);
            inserted += batchRows.length;
          } catch (err) {
            await pool.query("ROLLBACK");
            const firstId = batchRows[0]?.[PRIMARY_KEY[table]];
            const lastId = batchRows.at(-1)?.[PRIMARY_KEY[table]];
            throw new Error(
              `${table}: falló el INSERT del lote con ${PRIMARY_KEY[table]} entre "${firstId}" y "${lastId}" (${batchRows.length} filas) — ${err.message}. ROLLBACK aplicado, importación abortada.`,
            );
          }
        }
        await pool.query("COMMIT");
        importedCounts[table] = inserted;
        console.log(`  ✓ ${table.padEnd(26)} ${String(inserted).padStart(6)} filas importadas`);
      } catch (err) {
        console.error(`\n✗ ${err.message}`);
        process.exit(1);
      }
    }

    // ── Reposicionar secuencias de negocio por encima de cualquier número histórico ──
    console.log("\nReposicionando secuencias de negocio…");
    for (const { table, column, sequence, parseNumber } of BUSINESS_SEQUENCES) {
      const [rows] = await pool.query(`SELECT \`${column}\` AS v FROM \`${table}\``);
      let max = 0;
      for (const row of rows) {
        const n = parseNumber(row.v);
        if (n !== null && n > max) max = n;
      }
      await pool.query(`SELECT SETVAL(${sequence}, ?, true)`, [max]);
      console.log(`  ✓ ${sequence} reposicionada a ${max} (próximo NEXTVAL será ${max + 1})`);
    }

    console.log("\n✓ Importación completa.");
    console.log(JSON.stringify({ importedAt: new Date().toISOString(), counts: importedCounts }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error en import-mariadb.mjs:", err.message);
  process.exit(1);
});
