// Test de guardia (Fase DB-3K, endurecido en DB-5A): ningún archivo de
// RUNTIME (services, controllers, routes, jobs, middlewares,
// app.js/server.js/socket.js, db/pool.js, db/reset.js) debe contener
// sintaxis SQL exclusiva de PostgreSQL, un import de `pg`, ni branching por
// `config.db.driver` (ya no existe — MariaDB es el único motor desde la
// Fase DB-5A). No es un linter genérico de SQL — es una lista puntual de
// los patrones que esta migración encontró y convirtió.
//
// Alcance: backend/src/{services,controllers,routes,jobs,middlewares}/**/*.js,
// backend/src/{app,server,socket}.js, backend/src/db/{pool,reset}.js.
// Deliberadamente NO escanea:
//   - backend/db/archive/postgresql-migrations/*.sql: migraciones
//     históricas de Postgres, ya no ejecutables, archivadas a propósito.
//   - backend/src/seeds/**, backend/src/scripts/**: no son runtime
//     productivo (no los importa app.js/server.js, se invocan a mano por un
//     humano) — clasificados aparte en docs/MARIADB_MIGRATION.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");
const ROOT = path.join(__dirname, "..");

const SCAN_DIRS = ["services", "controllers", "routes", "jobs", "middlewares"];
const SCAN_FILES = ["app.js", "server.js", "socket.js"];

const NEVER_ALLOWED = [
  { name: "placeholder posicional $N", re: /\$\d+\b/ },
  { name: "ILIKE", re: /\bILIKE\b/ },
  { name: "FILTER (WHERE ...)", re: /FILTER\s*\(\s*WHERE/i },
  { name: "DATE_TRUNC", re: /\bDATE_TRUNC\b/i },
  { name: "generate_series", re: /\bgenerate_series\b/i },
  { name: "RETURNING", re: /\bRETURNING\b/ },
  { name: "cast :: de Postgres", re: /::[a-zA-Z]/ },
  { name: "INTERVAL 'literal'", re: /\bINTERVAL\s+'/i },
  { name: "ANY(...)", re: /\bANY\s*\(/ },
  // Desde la Fase DB-5A (MariaDB-only) ya no hay branching por
  // config.db.driver en ningún archivo — ON CONFLICT es Postgres-only sin
  // excepción.
  { name: "ON CONFLICT", re: /\bON CONFLICT\b/i },
  { name: "import de pg (motor retirado)", re: /from\s+["']pg["']/ },
  { name: "config.db.driver (branching retirado)", re: /config\.db\.driver/ },
];

function listJsFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && /\.m?js$/.test(entry.name)) out.push(full);
  }
  return out;
}

function isCommentLine(trimmed) {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

test("ningún archivo runtime contiene SQL/imports PostgreSQL-only", () => {
  // Desde la Fase DB-5A el pool en sí (db/pool.js) también es MariaDB-only,
  // así que ya no hace falta excluirlo del barrido.
  const files = [];
  for (const d of SCAN_DIRS) files.push(...listJsFiles(path.join(SRC, d)));
  for (const f of SCAN_FILES) files.push(path.join(SRC, f));
  files.push(path.join(SRC, "db", "pool.js"), path.join(SRC, "db", "reset.js"));

  assert.ok(files.length > 20, "el barrido debe cubrir al menos las decenas de archivos runtime esperadas (si esto falla, revisar SCAN_DIRS/SCAN_FILES)");

  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const relPath = path.relative(SRC, file);

    content.split("\n").forEach((line, i) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;

      for (const { name, re } of NEVER_ALLOWED) {
        if (re.test(line)) {
          violations.push(`${relPath}:${i + 1} — ${name}: ${trimmed.slice(0, 120)}`);
        }
      }
    });
  }

  assert.deepEqual(violations, [], `SQL/imports PostgreSQL-only encontrado en runtime:\n${violations.join("\n")}`);
});

test("pg no aparece como dependencia directa en package.json", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.dependencies?.pg, undefined, "pg no debería estar en dependencies — MariaDB es el único motor soportado");
  assert.equal(pkg.devDependencies?.pg, undefined, "pg no debería estar en devDependencies");
});

test("no queda ningún postgresql:// activo en los .env.example", () => {
  for (const envFile of [".env.example", ".env.production.example"]) {
    const full = path.join(ROOT, envFile);
    let content;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const activeLines = content
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"));
    const hasActivePostgres = activeLines.some((line) => /postgres(ql)?:\/\//.test(line));
    assert.equal(hasActivePostgres, false, `${envFile} no debería tener una línea activa con postgresql://`);
  }
});
