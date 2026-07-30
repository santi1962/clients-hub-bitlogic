#!/usr/bin/env node
// backup-postgres.mjs — Fase DB-4A, Sección 2: backup completo de la fuente
// antes de cualquier exportación.
//
// USO:
//   node backup-postgres.mjs --url postgresql://user:pass@host:port/db [--out-dir <ruta>]
//
// Genera un dump en formato custom de pg_dump (-Fc), fuera del repo por
// default, con checksum SHA-256, permisos restrictivos, y verifica que
// pg_restore pueda listar su contenido antes de darlo por bueno. Nunca
// modifica la base de origen (pg_dump es de solo lectura).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, existsSync, mkdirSync, chmodSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { describeUrl, assertNotProductionDatabaseUrl } from "./lib/db-url.js";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = { outDir: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    if (argv[i] === "--out-dir") args.outDir = argv[++i];
  }
  return args;
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function main() {
  const { url, outDir } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error("Uso: node backup-postgres.mjs --url postgresql://user:pass@host:port/db [--out-dir <ruta>]");
    process.exit(1);
  }
  assertNotProductionDatabaseUrl(url, "backup-postgres.mjs");

  // Default: fuera del árbol versionado del repo (backend/.mariadb-migration-data
  // ya está en .gitignore, pero para un backup real se recomienda --out-dir
  // apuntando por completo fuera del repositorio, ej. un disco separado).
  const targetDir = outDir
    ? path.resolve(outDir)
    : path.resolve(process.cwd(), ".mariadb-migration-data", "backups");
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dbNameForFile = (() => {
    try {
      return new URL(url).pathname.replace(/^\//, "") || "db";
    } catch {
      return "db";
    }
  })();
  const dumpPath = path.join(targetDir, `postgres-backup-${dbNameForFile}-${stamp}.dump`);

  console.log("──────────────────────────────────────────────");
  console.log(" backup-postgres.mjs — Fase DB-4A");
  console.log("──────────────────────────────────────────────");
  console.log(` Origen:  ${describeUrl(url)}`);
  console.log(` Destino: ${dumpPath}`);
  console.log("──────────────────────────────────────────────\n");

  // Versión del servidor (para el registro, no afecta el dump en sí).
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows: versionRows } = await client.query("SELECT version()");
  const { rows: tableCountRows } = await client.query(
    `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  await client.end();

  // pg_dump en formato custom (-Fc): comprimido, y el único formato que
  // pg_restore puede listar/filtrar tabla por tabla. --no-password evita
  // cualquier prompt interactivo; la contraseña viaja SOLO dentro de la
  // connection string (nunca como argumento separado visible en `ps`).
  const { stdout: dumpVersionOut } = await execFileAsync("pg_dump", ["--version"]);
  await execFileAsync("pg_dump", [url, "-Fc", "--no-password", "-f", dumpPath], {
    maxBuffer: 1024 * 1024 * 64,
  });

  if (!existsSync(dumpPath)) {
    throw new Error("pg_dump no generó el archivo esperado");
  }

  // Permisos restrictivos (0600) — best-effort: en NTFS/Windows chmod no
  // impone el mismo modelo de permisos que POSIX, pero se aplica igual por
  // si el backup se mueve a un filesystem POSIX (ej. el propio VPS).
  try {
    chmodSync(dumpPath, 0o600);
  } catch {
    // no crítico — algunos filesystems (NTFS) ignoran el modo POSIX
  }

  const checksum = await sha256File(dumpPath);
  const sizeBytes = statSync(dumpPath).size;

  // Verificación: pg_restore debe poder LISTAR el contenido del dump (no
  // restaurarlo) — confirma que el archivo no está corrupto/truncado.
  const { stdout: restoreListOut } = await execFileAsync("pg_restore", ["-l", dumpPath], {
    maxBuffer: 1024 * 1024 * 16,
  });
  const tableEntries = restoreListOut.split("\n").filter((l) => / TABLE DATA /.test(l));

  const metadata = {
    createdAt: now.toISOString(),
    sourceDescribed: describeUrl(url),
    dumpPath,
    sizeBytes,
    sha256: checksum,
    pgDumpVersion: dumpVersionOut.trim(),
    postgresServerVersion: versionRows[0].version,
    tableCountInSchema: parseInt(tableCountRows[0].count, 10),
    tableDataEntriesInDump: tableEntries.length,
    format: "custom (pg_dump -Fc)",
  };
  const metadataPath = dumpPath + ".meta.json";
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  try {
    chmodSync(metadataPath, 0o600);
  } catch {}

  console.log("✓ Backup creado y verificado:\n");
  console.log(`  Ruta:               ${dumpPath}`);
  console.log(`  Tamaño:              ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  SHA-256:             ${checksum}`);
  console.log(`  pg_dump:             ${metadata.pgDumpVersion}`);
  console.log(`  Servidor Postgres:   ${metadata.postgresServerVersion.split(",")[0]}`);
  console.log(`  Tablas en schema:    ${metadata.tableCountInSchema}`);
  console.log(`  Tablas con datos en el dump (pg_restore -l): ${tableEntries.length}`);
  console.log(`  Metadata:            ${metadataPath}\n`);
  console.log("No se modificó la base de origen. No se borró ningún backup anterior.");
}

main().catch((err) => {
  console.error("Error en backup-postgres.mjs:", err.message);
  process.exit(1);
});
