// Verifica, de forma automatizada y permanente, la protección estructural
// contra el incidente de la Fase DB-3A: un fixture con escrituras reales
// (test/fixtures/mariadb-auth-flow.mjs) corrió suelto por auto-discovery de
// `node --test` y escribió datos de prueba en la Postgres local de
// desarrollo, antes de que existiera ninguna protección.
//
// Dos capas de protección, ambas verificadas acá (Fase DB-2.5, "aplicar una
// protección estructural, no solo confiar en nombres"):
//   1. Estructural: `npm test` corre con un glob explícito
//      (`test/**/*.test.js`, ver package.json) que nunca matchea nada bajo
//      fixtures/ ni helpers/ — no dependen de que cada fixture recuerde
//      poner un guard.
//   2. Guard explícito en el fixture mismo, por si alguna vez se invoca
//      directo (`node test/fixtures/mariadb-auth-flow.mjs`) por fuera de
//      `npm test` — defensa en profundidad, no una u otra.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, "..");
const FIXTURE = path.join(__dirname, "fixtures", "mariadb-auth-flow.mjs");

test("protección 1 (estructural): el glob de `npm test` nunca incluye archivos bajo test/fixtures/ ni test/helpers/", () => {
  const matches = globSync("test/**/*.test.js", { cwd: BACKEND_DIR });
  const offending = matches.filter((m) => m.includes("fixtures") || m.includes("helpers"));
  assert.deepEqual(offending, [], "el patrón usado por package.json no debe matchear nada en fixtures/ ni helpers/");
  assert.ok(matches.length > 0, "el patrón debe seguir encontrando los archivos *.test.js reales");
});

test("protección 2 (guard explícito): correr el fixture MariaDB suelto, sin MARIADB_FIXTURE_RUN, no escribe nada y termina en 0", () => {
  // Se corre con el DATABASE_URL real del proceso de test (Postgres local) a
  // propósito — es exactamente el escenario del incidente: si el guard
  // fallara, esto insertaría datos ahí mismo.
  const result = spawnSync(process.execPath, [FIXTURE], {
    cwd: BACKEND_DIR,
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env }, // sin MARIADB_FIXTURE_RUN
  });

  assert.equal(result.status, 0, "debe salir limpio (exit 0), no intentar conectarse ni escribir");
  assert.equal(result.stdout.trim(), "", "no debe imprimir nada — confirma que run() nunca se ejecutó");
});
