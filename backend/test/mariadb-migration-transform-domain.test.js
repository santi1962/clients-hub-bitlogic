// Tests unitarios (sin base de datos, fixtures sintéticos) del migrador de
// datos reales PostgreSQL -> MariaDB (Fase DB-4A). Cubren las
// transformaciones puras y la detección de colisiones case-insensitive —
// la parte del migrador que no depende de una conexión real. La cobertura
// contra motores reales (rollback de lote, duplicados, checksum, manifest,
// secuencias) está en mariadb-migration-mariadb.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transformUuid,
  transformNumeric,
  transformTimestamp,
  transformDate,
  transformJson,
  transformBoolean,
  transformText,
  sha256Hex,
  normalizeDecimalForComparison,
} from "../scripts/mariadb-migration/lib/transform.js";
import { TABLE_ORDER, PRIMARY_KEY, BUSINESS_SEQUENCES } from "../scripts/mariadb-migration/table-order.js";
import {
  findCaseInsensitiveCollisionsInRows,
  formatCollisionsReport,
} from "../scripts/mariadb-migration/check-collisions.mjs";

// ── UUID ──────────────────────────────────────────────────────

test("transformUuid: acepta un UUID válido y lo devuelve exacto (sin normalizar mayúsculas)", () => {
  const id = "550E8400-E29B-41D4-A716-446655440000";
  assert.equal(transformUuid(id), id);
});

test("transformUuid: null/undefined pasan como null", () => {
  assert.equal(transformUuid(null), null);
  assert.equal(transformUuid(undefined), null);
});

test("transformUuid: rechaza un valor que no tiene forma de UUID", () => {
  assert.throws(() => transformUuid("no-es-un-uuid"), /no es un UUID válido/);
});

// ── NUMERIC/DECIMAL ───────────────────────────────────────────

test("transformNumeric: preserva el string exacto, nunca pasa por Number()", () => {
  assert.equal(transformNumeric("100.10"), "100.10", "un cero final no debe perderse");
  assert.equal(transformNumeric("0.00"), "0.00");
  assert.equal(transformNumeric(null), null);
});

test("normalizeDecimalForComparison: 100.10 y 100.1 se consideran el mismo valor semántico", () => {
  assert.equal(normalizeDecimalForComparison("100.10"), normalizeDecimalForComparison("100.1"));
  assert.equal(normalizeDecimalForComparison("0"), "0.00");
});

// ── Fechas ────────────────────────────────────────────────────

test("transformTimestamp: convierte a ISO 8601 UTC con sufijo Z", () => {
  const result = transformTimestamp("2026-07-30 12:00:00+00");
  assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("transformTimestamp: rechaza una fecha inválida en vez de devolver 'Invalid Date' silenciosamente", () => {
  assert.throws(() => transformTimestamp("no-es-una-fecha"), /no es una fecha válida/);
});

test("transformDate: YYYY-MM-DD ya en ese formato pasa intacto (sin aplicar ninguna zona horaria)", () => {
  assert.equal(transformDate("2026-07-30"), "2026-07-30");
});

test("transformDate: un objeto Date se recorta a YYYY-MM-DD", () => {
  assert.equal(transformDate(new Date("2026-01-05T00:00:00.000Z")), "2026-01-05");
});

// ── JSON ──────────────────────────────────────────────────────

test("transformJson: serializa un objeto a string JSON válido", () => {
  const result = transformJson({ emails: ["a@b.com"], nested: { ok: true } });
  assert.equal(JSON.parse(result).emails[0], "a@b.com");
});

test("transformJson: si ya viene como string, valida que sea JSON parseable y lo re-serializa (no lo pasa crudo)", () => {
  const result = transformJson('{"a":1}');
  assert.equal(result, JSON.stringify({ a: 1 }));
});

test("transformJson: JSON con tildes/ñ/emoji se preserva semánticamente", () => {
  const original = { nota: "año 2026, ñoño ☕🎉" };
  const result = JSON.parse(transformJson(original));
  assert.deepEqual(result, original);
});

// ── Booleanos ─────────────────────────────────────────────────

test("transformBoolean: true/false pasan como boolean real, no 0/1", () => {
  assert.strictEqual(transformBoolean(true), true);
  assert.strictEqual(transformBoolean(false), false);
  assert.strictEqual(transformBoolean(null), null);
});

// ── Texto / NULL ──────────────────────────────────────────────

test("transformText: preserva UTF-8 exacto (tildes, ñ, emoji, saltos de línea)", () => {
  const text = "Café del Valle ☕\nLínea 2 con ñoño";
  assert.equal(transformText(text), text);
});

test("transformText: undefined se normaliza a null, pero null se preserva como null", () => {
  assert.equal(transformText(undefined), null);
  assert.equal(transformText(null), null);
  assert.equal(transformText(""), "");
});

// ── Checksum ──────────────────────────────────────────────────

test("sha256Hex: mismo contenido da el mismo hash, contenido distinto da hash distinto", () => {
  const a = sha256Hex("línea 1\nlínea 2");
  const b = sha256Hex("línea 1\nlínea 2");
  const c = sha256Hex("línea 1\nlínea 3");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ── table-order.js ────────────────────────────────────────────

test("TABLE_ORDER: tiene las 20 tablas, sin duplicados, y cada FK aparece después de su tabla referenciada", () => {
  assert.equal(TABLE_ORDER.length, 20);
  assert.equal(new Set(TABLE_ORDER).size, 20);

  const index = Object.fromEntries(TABLE_ORDER.map((t, i) => [t, i]));
  const FK_EDGES = [
    ["refresh_tokens", "users"],
    ["hosting_services", "clients"],
    ["hosting_services", "hosting_plans"],
    ["domains", "clients"],
    ["domains", "hosting_services"],
    ["payments", "payment_notices"],
    ["internal_tasks", "support_tickets"],
    ["internal_tasks", "domains"],
    ["email_logs", "domains"],
  ];
  for (const [child, parent] of FK_EDGES) {
    assert.ok(index[child] > index[parent], `${child} debe importarse después de ${parent}`);
  }
});

test("PRIMARY_KEY: todas las tablas usan 'id' como PK", () => {
  for (const table of TABLE_ORDER) {
    assert.equal(PRIMARY_KEY[table], "id");
  }
});

test("BUSINESS_SEQUENCES: parseNumber extrae el número de AV-YYYY-NNNN y TK-YYYY-NNNN", () => {
  const notices = BUSINESS_SEQUENCES.find((s) => s.table === "payment_notices");
  const tickets = BUSINESS_SEQUENCES.find((s) => s.table === "support_tickets");
  assert.equal(notices.parseNumber("AV-2026-0042"), 42);
  assert.equal(notices.parseNumber("no-matchea"), null);
  assert.equal(tickets.parseNumber("TK-2026-0007"), 7);
});

// ── Colisiones case-insensitive ──────────────────────────────

test("findCaseInsensitiveCollisionsInRows: detecta dos emails que solo difieren en mayúsculas/minúsculas", () => {
  const rows = [
    { id: "u1", email: "Cliente@Test.com" },
    { id: "u2", email: "cliente@test.com" },
    { id: "u3", email: "otro@test.com" },
  ];
  const collisions = findCaseInsensitiveCollisionsInRows(rows, "email");
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0].ids, ["u1", "u2"]);
});

test("findCaseInsensitiveCollisionsInRows: sin colisiones cuando todos los valores son case-únicos", () => {
  const rows = [{ id: "u1", email: "a@test.com" }, { id: "u2", email: "b@test.com" }];
  assert.deepEqual(findCaseInsensitiveCollisionsInRows(rows, "email"), []);
});

test("findCaseInsensitiveCollisionsInRows: ignora valores null", () => {
  const rows = [{ id: "u1", email: null }, { id: "u2", email: null }];
  assert.deepEqual(findCaseInsensitiveCollisionsInRows(rows, "email"), []);
});

test("formatCollisionsReport: sin colisiones da un mensaje claro; con colisiones lista tabla/columna/ids sin exponer otras columnas", () => {
  assert.match(formatCollisionsReport([]), /Sin colisiones/);
  const report = formatCollisionsReport([
    { table: "users", column: "email", lowerValue: "x@test.com", ids: ["u1", "u2"], values: ["X@test.com", "x@test.com"] },
  ]);
  assert.match(report, /users\.email/);
  assert.match(report, /u1, u2/);
});
