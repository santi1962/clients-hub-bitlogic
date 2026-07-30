// Prueba la lógica pura de backend/src/utils/assert-node-version.js. El
// import del módulo real (no un mock) ya ejecuta su propio chequeo contra el
// Node real del proceso de test como efecto de carga — si este archivo corre
// bajo un Node más viejo que el requerido, el runner de tests mismo fallaría
// al importarlo, lo cual es exactamente el comportamiento esperado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { meetsMinimumNodeVersion, parseNodeVersion, REQUIRED_MAJOR, REQUIRED_MINOR } from "../src/utils/assert-node-version.js";

test("assert-node-version: la política requerida es >=22.12", () => {
  assert.equal(REQUIRED_MAJOR, 22);
  assert.equal(REQUIRED_MINOR, 12);
});

test("assert-node-version: parsea major/minor de un string de versión real", () => {
  assert.deepEqual(parseNodeVersion("22.19.0"), { major: 22, minor: 19 });
  assert.deepEqual(parseNodeVersion("18.20.4"), { major: 18, minor: 20 });
});

test("assert-node-version: rechaza versiones menores a 22.12", () => {
  assert.equal(meetsMinimumNodeVersion("18.20.4"), false);
  assert.equal(meetsMinimumNodeVersion("20.19.0"), false);
  assert.equal(meetsMinimumNodeVersion("22.11.9"), false);
});

test("assert-node-version: acepta 22.12.0 exacto y versiones mayores", () => {
  assert.equal(meetsMinimumNodeVersion("22.12.0"), true);
  assert.equal(meetsMinimumNodeVersion("22.19.0"), true);
  assert.equal(meetsMinimumNodeVersion("23.0.0"), true);
  assert.equal(meetsMinimumNodeVersion("24.1.2"), true);
});

test("assert-node-version: el Node real que corre esta suite ya cumple la política", () => {
  assert.equal(meetsMinimumNodeVersion(process.versions.node), true, `Node actual: ${process.versions.node}`);
});
