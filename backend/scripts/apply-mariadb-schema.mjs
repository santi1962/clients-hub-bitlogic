#!/usr/bin/env node
// backend/scripts/apply-mariadb-schema.mjs
//
// Aplica backend/db/schema.sql contra una base MariaDB de PRUEBA, vía el
// cliente `mariadb`/`mysql` (CLI). El schema usa DELIMITER para sus 2
// triggers con cuerpo multi-sentencia — es una directiva del cliente CLI, no
// SQL real, y no se puede mandar tal cual vía pool.query() de ningún driver
// sin habilitar multipleStatements. Este proyecto deliberadamente NO
// habilita esa opción en el pool de la aplicación (backend/src/db/pool.js) —
// este script resuelve la carga del schema por fuera de ese pool, usando el
// cliente CLI directo, que sí entiende DELIMITER de forma nativa.
//
// USO:
//   npm run db:schema:mariadb -- --url mysql://user:pass@host:port/dbname [--dry-run]
//   MARIADB_SCHEMA_URL=mysql://... node scripts/apply-mariadb-schema.mjs
//
// Para una inicialización productiva controlada (nombre de base real, sin
// palabras como "test/dev"), agregar --confirm-production explícitamente:
//   node scripts/apply-mariadb-schema.mjs --url mysql://... --confirm-production
//
// SALVAGUARDAS:
//   - Requiere la URL explícita por --url o MARIADB_SCHEMA_URL. Nunca lee
//     DATABASE_URL ni ninguna otra variable "productiva" del backend.
//   - Rechaza ejecutar si el nombre de la base no contiene ninguna palabra
//     de SAFE_NAME_HINTS (test/dev/scratch/etc.), salvo que se pase
//     --confirm-production explícitamente — corta el caso más común de
//     accidente (pegar la URL equivocada) sin bloquear el uso legítimo
//     contra una base productiva real.
//   - No contiene credenciales propias — todo sale de la URL que pasa quien
//     lo ejecuta.
//   - No crea la base de datos (debe existir de antemano) ni ejecuta seeds.
//   - Aborta ante cualquier error del cliente (código de salida != 0).

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.join(__dirname, "..", "db", "schema.sql");

const SAFE_NAME_HINTS = [
  "test", "dev", "scratch", "tmp", "temp", "descartable",
  "throwaway", "local", "sandbox", "ignorad", "prueba",
];

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, url: null, confirmProduction: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--confirm-production") args.confirmProduction = true;
  }
  return args;
}

function findClient() {
  for (const bin of ["mariadb", "mysql"]) {
    const check = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (check.status === 0) return bin;
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const urlString = args.url || process.env.MARIADB_SCHEMA_URL;

if (!urlString) {
  fail(
    "Falta la URL de destino. Pasala explícita con --url mysql://user:pass@host:port/dbname\n" +
      "  o con la variable de entorno MARIADB_SCHEMA_URL. A propósito NUNCA se usa\n" +
      "  DATABASE_URL por default, para no correr esto contra una base productiva por accidente.",
  );
}

let url;
try {
  url = new URL(urlString);
} catch {
  fail(`La URL no es válida: ${urlString}`);
}

if (!/^mysql2?:$/.test(url.protocol)) {
  fail(`Esquema no soportado (${url.protocol}) — se esperaba mysql:// o mysql2://.`);
}

const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!dbName) {
  fail("La URL no especifica una base de datos (path vacío).");
}

const looksSafe = SAFE_NAME_HINTS.some((hint) => dbName.toLowerCase().includes(hint));
if (!looksSafe && !args.confirmProduction) {
  fail(
    `El nombre de base "${dbName}" no parece de prueba/desarrollo (no contiene ninguna de: ${SAFE_NAME_HINTS.join(", ")}).\n` +
      "  Si es una base de prueba, renombrala para que quede explícito (ej. \"bitlogic_schema_test\").\n" +
      "  Si es una inicialización productiva real e intencional, volvé a correr con --confirm-production.",
  );
}
if (!looksSafe && args.confirmProduction) {
  console.log(`⚠ --confirm-production: aplicando el schema contra "${dbName}" pese a no tener un nombre de prueba/desarrollo.\n`);
}

console.log("──────────────────────────────────────────────");
console.log(" apply-mariadb-schema.mjs");
console.log("──────────────────────────────────────────────");
console.log(` Host:     ${url.hostname}`);
console.log(` Puerto:   ${url.port || 3306}`);
console.log(` Base:     ${dbName}`);
console.log(` Usuario:  ${decodeURIComponent(url.username || "(sin especificar)")}`);
console.log(` Schema:   ${SCHEMA_FILE}`);
console.log(` Dry-run:  ${args.dryRun ? "sí (no se ejecuta nada)" : "no"}`);
console.log("──────────────────────────────────────────────\n");

if (!existsSync(SCHEMA_FILE)) {
  fail(`No se encontró el schema en ${SCHEMA_FILE}`);
}

const schemaSql = readFileSync(SCHEMA_FILE, "utf8");

if (args.dryRun) {
  console.log(`Dry-run: ${SCHEMA_FILE} tiene ${schemaSql.split("\n").length} líneas. No se ejecutó nada contra ${url.hostname}:${url.port || 3306}/${dbName}.`);
  process.exit(0);
}

const client = findClient();
if (!client) {
  fail(
    "No se encontró el cliente `mariadb` ni `mysql` en el PATH. Hace falta uno de los dos para\n" +
      "  correr los triggers con DELIMITER del schema — no son SQL real, mysql2/pg no pueden\n" +
      "  ejecutarlos sin habilitar multipleStatements (deliberadamente no habilitado en esta app).",
  );
}
console.log(`Usando cliente: ${client}\n`);

const result = spawnSync(
  client,
  [
    "--host", url.hostname,
    "--port", String(url.port || 3306),
    "--user", decodeURIComponent(url.username || "root"),
    dbName,
  ],
  {
    input: schemaSql,
    encoding: "utf8",
    // La contraseña va por variable de entorno, no por argumento de línea de
    // comandos (evita que quede visible en la lista de procesos del SO).
    env: { ...process.env, MYSQL_PWD: url.password ? decodeURIComponent(url.password) : "" },
  },
);

if (result.error) {
  fail(`No se pudo ejecutar ${client}: ${result.error.message}`);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  fail(`${client} terminó con código ${result.status}. Ver el error de arriba — no se ocultó nada con IGNORE.`);
}

console.log("\n✓ Schema aplicado correctamente.\n");
