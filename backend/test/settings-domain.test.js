// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio Settings (Fase DB-3H): UUID v4 generado en la app
// (crypto.randomUUID(), reemplaza uuidv4() del paquete "uuid"), placeholders
// `?`, y el patrón UPDATE/INSERT + SELECT posterior dentro de la misma
// transacción que ya existía (BEGIN/COMMIT/ROLLBACK, sin cambios de
// estructura). La cobertura contra un motor MariaDB real está en
// settings-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as settingsService from "../src/services/settings.service.js";
import { mockPoolQueries, mockPoolConnect } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeSettingsRow(overrides = {}) {
  return {
    id: "cfg-1", company_name: "Bitlogic SRL", contact_email: "hola@bitlogic.com.ar",
    phone: null, tax_id: null, address: null, currency: "ARS", logo_url: null,
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

test("settingsService.getCompanySettings: null si no hay ninguna fila (sin configurar todavía)", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  const result = await settingsService.getCompanySettings();

  assert.equal(result, null);
});

test("settingsService.getCompanySettings: mapea la fila real, logoUrl null si no hay logo", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeSettingsRow()] }]);

  const result = await settingsService.getCompanySettings();

  assert.equal(result.companyName, "Bitlogic SRL");
  assert.equal(result.logoUrl, null);
});

test("settingsService.updateCompanySettings: sin fila previa, genera un UUID v4 en la app y lo reusa en el SELECT posterior (dentro de la misma transacción)", async (t) => {
  let insertParams;
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [] },               // SELECT id FROM company_settings LIMIT 1 (no existe)
    { rows: [], rowCount: 1 },  // INSERT (capturamos params abajo)
    { rows: [fakeSettingsRow()] }, // SELECT * FROM company_settings WHERE id = ?
    { rows: [], rowCount: 1 },  // COMMIT
  ]);

  const result = await settingsService.updateCompanySettings({
    companyName: "Bitlogic SRL", contactEmail: "hola@bitlogic.com.ar",
    phone: null, taxId: null, address: null, currency: "ARS",
  });

  assert.equal(queries.length, 5);
  assert.match(queries[0], /^BEGIN$/);
  assert.match(queries[1], /SELECT id FROM company_settings/);
  assert.match(queries[2], /INSERT INTO company_settings/);
  assert.match(queries[3], /SELECT \* FROM company_settings WHERE id = \?/);
  assert.match(queries[4], /^COMMIT$/);
  assert.equal(result.companyName, "Bitlogic SRL");
});

test("settingsService.updateCompanySettings: UUID v4 real generado (no uuidv4() del paquete uuid)", async (t) => {
  let insertParams;
  const original = pool.connect;
  pool.connect = async () => ({
    query: async (sql, params) => {
      if (sql.startsWith("INSERT")) insertParams = params;
      if (sql.startsWith("SELECT id")) return { rows: [] };
      if (sql.startsWith("SELECT *")) return { rows: [fakeSettingsRow({ id: params[0] })] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  });
  t.after(() => { pool.connect = original; });

  await settingsService.updateCompanySettings({ companyName: "Bitlogic SRL", currency: "ARS" });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4 generado por la app");
});

test("settingsService.updateCompanySettings: con fila previa, reusa el mismo id existente (UPDATE, no INSERT)", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },              // BEGIN
    { rows: [{ id: "cfg-existente" }] },     // SELECT id: ya existe
    { rows: [], rowCount: 1 },              // UPDATE
    { rows: [fakeSettingsRow({ id: "cfg-existente", currency: "USD" })] }, // SELECT final
    { rows: [], rowCount: 1 },              // COMMIT
  ]);

  const result = await settingsService.updateCompanySettings({ companyName: "Bitlogic SRL", currency: "USD" });

  assert.ok(queries[2].includes("UPDATE company_settings"));
  assert.doesNotMatch(queries[2], /INSERT/);
  assert.equal(result.id, "cfg-existente");
  assert.equal(result.currency, "USD");
});

test("settingsService.updateCompanySettings: un error mid-transacción hace ROLLBACK y se propaga", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [] },                // SELECT id: no existe
    new Error("constraint violation"), // INSERT falla
    { rows: [], rowCount: 1 },  // ROLLBACK
  ]);

  await assert.rejects(() => settingsService.updateCompanySettings({ companyName: "X", currency: "ARS" }));

  assert.equal(queries.length, 4);
  assert.match(queries[3], /^ROLLBACK$/);
});

test("settingsService.updateCompanyLogo: sin fila previa, el INSERT no envía company_name (bug preexistente, ver docs/MARIADB_MIGRATION.md — se preserva, no se inventa un valor)", async (t) => {
  let insertParams;
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [] },                // SELECT id: no existe
    { rows: [], rowCount: 1 },  // INSERT
    { rows: [fakeSettingsRow({ logo_url: "/api/settings/company/logo/logo-1.png" })] }, // SELECT final
    { rows: [], rowCount: 1 },  // COMMIT
  ]);

  const result = await settingsService.updateCompanyLogo("/api/settings/company/logo/logo-1.png");

  assert.match(queries[2], /INSERT INTO company_settings \(id, logo_url\)/);
  assert.equal(result.logoUrl, "/api/settings/company/logo/logo-1.png");
});

test("settingsService.updateCompanyLogo: con fila previa, solo actualiza logo_url", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },
    { rows: [{ id: "cfg-existente" }] },
    { rows: [], rowCount: 1 },
    { rows: [fakeSettingsRow({ id: "cfg-existente", logo_url: "/logo-2.png" })] },
    { rows: [], rowCount: 1 },
  ]);

  const result = await settingsService.updateCompanyLogo("/logo-2.png");

  assert.match(queries[2], /UPDATE company_settings SET logo_url = \?/);
  assert.equal(result.logoUrl, "/logo-2.png");
});
