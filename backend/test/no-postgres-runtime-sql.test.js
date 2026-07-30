// Test de guardia (Fase DB-3K): ningún archivo de RUNTIME (services,
// controllers, routes, jobs, middlewares, app.js/server.js/socket.js) debe
// contener sintaxis SQL exclusiva de PostgreSQL sin resolver. No es un
// linter genérico de SQL — es una lista puntual de los patrones que esta
// migración encontró y convirtió, más las excepciones explícitas que el
// propio proyecto documenta (ver docs/MARIADB_MIGRATION.md).
//
// Alcance: backend/src/{services,controllers,routes,jobs,middlewares}/**/*.js
// y backend/src/{app,server,socket}.js. Deliberadamente NO escanea:
//   - backend/src/db/pool.js: es la capa de compatibilidad en sí — traduce
//     `?` a `$N` para Postgres, y sus comentarios internos mencionan `$N`
//     como parte de esa explicación.
//   - backend/src/migrations/*.sql: migraciones históricas de Postgres,
//     nunca se ejecutan contra MariaDB, archivadas a propósito (no se tocan
//     ni se migran, ver "No archivar todavía migraciones PostgreSQL").
//   - backend/src/seeds/**, backend/src/scripts/**, backend/src/db/reset.js:
//     no son runtime productivo (no los importa app.js/server.js, se
//     invocan a mano por un humano) — clasificados aparte en
//     docs/MARIADB_MIGRATION.md (Fase DB-3K, sección de seeds/scripts).
//
// Dos categorías de patrón:
//   1. NEVER_ALLOWED: no tienen NINGÚN caso legítimo de branching en este
//      proyecto — todos ya tienen un reemplazo portable de una sola query
//      (placeholders `?`, LOWER()/LIKE, CASE WHEN, fechas en Node, etc.).
//      Cualquier aparición fuera de un comentario es una regresión real.
//   2. ALLOWED_IF_BRANCHED: la única sintaxis que SÍ varía legítimamente por
//      motor (ON CONFLICT/ON DUPLICATE KEY UPDATE, NEXTVAL/SETVAL con o sin
//      comillas) — permitida únicamente si el archivo contiene la marca de
//      branching real (`config.db.driver`), para no aceptar código muerto
//      sin bifurcar. No valida que el branching esté bien armado línea por
//      línea (para eso están los tests de integración MariaDB reales de
//      cada dominio) — solo que no haya sintaxis Postgres-only "suelta".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");

const SCAN_DIRS = ["services", "controllers", "routes", "jobs", "middlewares"];
const SCAN_FILES = ["app.js", "server.js", "socket.js"];

const EXCLUDED_FILES = new Set([path.join(SRC, "db", "pool.js")]);

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
];

const ALLOWED_IF_BRANCHED = [
  { name: "ON CONFLICT", re: /\bON CONFLICT\b/i },
  { name: "NEXTVAL(...)", re: /\bNEXTVAL\s*\(/i },
  { name: "SETVAL(...)", re: /\bSETVAL\s*\(/i },
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

test("ningún archivo runtime contiene SQL PostgreSQL-only sin resolver ni sin branching documentado", () => {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...listJsFiles(path.join(SRC, d)));
  for (const f of SCAN_FILES) files.push(path.join(SRC, f));

  assert.ok(files.length > 20, "el barrido debe cubrir al menos las decenas de archivos runtime esperadas (si esto falla, revisar SCAN_DIRS/SCAN_FILES)");

  const violations = [];

  for (const file of files) {
    if (EXCLUDED_FILES.has(file)) continue;
    const content = readFileSync(file, "utf8");
    const hasBranchMarker = /config\.db\.driver/.test(content);
    const relPath = path.relative(SRC, file);

    content.split("\n").forEach((line, i) => {
      const trimmed = line.trim();
      if (isCommentLine(trimmed)) return;

      for (const { name, re } of NEVER_ALLOWED) {
        if (re.test(line)) {
          violations.push(`${relPath}:${i + 1} — ${name}: ${trimmed.slice(0, 120)}`);
        }
      }
      for (const { name, re } of ALLOWED_IF_BRANCHED) {
        if (re.test(line) && !hasBranchMarker) {
          violations.push(`${relPath}:${i + 1} — ${name} sin branching por config.db.driver en el archivo: ${trimmed.slice(0, 120)}`);
        }
      }
    });
  }

  assert.deepEqual(violations, [], `SQL PostgreSQL-only encontrado en runtime:\n${violations.join("\n")}`);
});

test("las excepciones declaradas siguen existiendo (si se borra pool.js el test de arriba pasaría por razones equivocadas)", () => {
  for (const excluded of EXCLUDED_FILES) {
    assert.doesNotThrow(() => readFileSync(excluded, "utf8"), `${excluded} debería existir`);
  }
});
