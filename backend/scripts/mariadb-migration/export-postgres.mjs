#!/usr/bin/env node
// export-postgres.mjs — Fase DB-4A, Sección 5: exportación de PostgreSQL a
// un formato intermedio (NDJSON por tabla + manifest.json).
//
// USO:
//   node export-postgres.mjs --url postgresql://user:pass@host:port/db [--out-dir <ruta>] [--allow-collisions]
//
// Por qué NDJSON y no CSV: columnas JSONB/texto complejo (saltos de línea,
// comas, comillas) no tienen una representación CSV libre de ambigüedad sin
// escapar manualmente — NDJSON (un objeto JSON por línea) preserva tipos y
// caracteres especiales sin ningún escapeo custom. No se usa sed/regex en
// ningún punto de esta herramienta.
//
// Solo lectura contra Postgres — ningún UPDATE/DELETE, ninguna escritura.
import pg from "pg";
import { writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TABLE_ORDER, PRIMARY_KEY } from "./table-order.js";
import {
  transformUuid,
  transformNumeric,
  transformTimestamp,
  transformDate,
  transformJson,
  transformBoolean,
  transformText,
  sha256Hex,
} from "./lib/transform.js";
import { describeUrl, assertNotProductionDatabaseUrl } from "./lib/db-url.js";
import { findCaseInsensitiveCollisions, formatCollisionsReport } from "./check-collisions.mjs";

const execFileAsync = promisify(execFile);
const FORMAT_VERSION = 1;

function parseArgs(argv) {
  const args = { outDir: null, allowCollisions: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    if (argv[i] === "--out-dir") args.outDir = argv[++i];
    if (argv[i] === "--allow-collisions") args.allowCollisions = true;
  }
  return args;
}

const UDT_TRANSFORMS = {
  uuid: transformUuid,
  numeric: transformNumeric,
  timestamptz: transformTimestamp,
  timestamp: transformTimestamp,
  date: transformDate,
  jsonb: transformJson,
  json: transformJson,
  bool: transformBoolean,
};

function pickTransform(udtName) {
  return UDT_TRANSFORMS[udtName] ?? transformText;
}

async function getGitCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function main() {
  const { url, outDir, allowCollisions } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error("Uso: node export-postgres.mjs --url postgresql://user:pass@host:port/db [--out-dir <ruta>] [--allow-collisions]");
    process.exit(1);
  }
  assertNotProductionDatabaseUrl(url, "export-postgres.mjs");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = outDir
    ? path.resolve(outDir)
    : path.resolve(process.cwd(), ".mariadb-migration-data", "exports", stamp);
  mkdirSync(targetDir, { recursive: true });

  console.log("──────────────────────────────────────────────");
  console.log(" export-postgres.mjs — Fase DB-4A");
  console.log("──────────────────────────────────────────────");
  console.log(` Origen: ${describeUrl(url)}`);
  console.log(` Salida: ${targetDir}`);
  console.log("──────────────────────────────────────────────\n");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    // ── Sección 8: colisiones case-insensitive — pre-flight, aborta salvo --allow-collisions ──
    const collisions = await findCaseInsensitiveCollisions(client);
    if (collisions.length) {
      console.error(formatCollisionsReport(collisions));
      if (!allowCollisions) {
        console.error("\n✗ Abortando: hay colisiones case-insensitive sin resolver. Decidí manualmente cuál registro prevalece y volvé a correr, o pasá --allow-collisions si ya lo evaluaste (la importación fallará igual en MariaDB si no se resolvieron de verdad).");
        process.exit(1);
      }
      console.warn("\n⚠ --allow-collisions: se continúa la exportación pese a las colisiones detectadas arriba.");
    } else {
      console.log("✓ Sin colisiones case-insensitive (users.email, clients.email, hosting_services.domain, domains.domain).\n");
    }

    const { rows: versionRows } = await client.query("SELECT version()");

    const manifest = {
      formatVersion: FORMAT_VERSION,
      generatedAt: new Date().toISOString(),
      timezone: "UTC",
      sourceEngine: "postgresql",
      sourceVersion: versionRows[0].version,
      sourceDescribed: describeUrl(url),
      appCommit: await getGitCommit(),
      tableOrder: TABLE_ORDER,
      tables: {},
      collisions: collisions.length ? collisions : undefined,
    };

    for (const table of TABLE_ORDER) {
      const pk = PRIMARY_KEY[table];
      const { rows: colInfo } = await client.query(
        `SELECT column_name, udt_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      if (colInfo.length === 0) {
        throw new Error(`export-postgres.mjs: la tabla "${table}" (listada en TABLE_ORDER) no existe en el origen — abortando, no continuar silenciosamente`);
      }

      const { rows } = await client.query(`SELECT * FROM "${table}" ORDER BY "${pk}" ASC`);

      const ndjsonLines = rows.map((row) => {
        const out = {};
        for (const { column_name, udt_name } of colInfo) {
          const transform = pickTransform(udt_name);
          try {
            out[column_name] = transform(row[column_name]);
          } catch (err) {
            throw new Error(`export-postgres.mjs: tabla "${table}", columna "${column_name}", fila con ${pk}=${row[pk]}: ${err.message}`);
          }
        }
        return JSON.stringify(out);
      });

      const filePath = path.join(targetDir, `${table}.ndjson`);
      writeFileSync(filePath, ndjsonLines.length ? ndjsonLines.join("\n") + "\n" : "");
      try {
        chmodSync(filePath, 0o600);
      } catch {}

      const checksum = sha256Hex(ndjsonLines.join("\n"));
      manifest.tables[table] = {
        rowCount: rows.length,
        file: `${table}.ndjson`,
        sha256: checksum,
        columns: colInfo.map((c) => c.column_name),
      };

      console.log(`  ✓ ${table.padEnd(26)} ${String(rows.length).padStart(6)} filas  sha256:${checksum.slice(0, 12)}…`);
    }

    const manifestPath = path.join(targetDir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    try {
      chmodSync(manifestPath, 0o600);
    } catch {}

    console.log(`\n✓ Exportación completa: ${targetDir}`);
    console.log(`  manifest.json con ${Object.keys(manifest.tables).length} tablas, formatVersion=${FORMAT_VERSION}`);
    console.log("\nNo se modificó la base de origen.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Error en export-postgres.mjs:", err.message);
  process.exit(1);
});
