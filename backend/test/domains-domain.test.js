// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio domains (Fase DB-3E): UUID v4 generado en la app,
// placeholders `?`, normalización de BOOLEAN (0/1 -> true/false) y DECIMAL
// (string -> Number vía parseFloat, ya no `::float` en SQL), y el cálculo en
// Node de la fecha de corte de "expiringInDays" (sin INTERVAL parametrizado,
// exclusivo de Postgres). La cobertura contra un motor MariaDB real está en
// domains-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as domainsService from "../src/services/domains.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeDomainRow(overrides = {}) {
  return {
    id: "domain-1", client_id: "client-1", hosting_service_id: null,
    domain: "ejemplo.com", registrar: "NIC.ar", registration_date: "2024-01-01",
    expiration_date: "2027-01-01", auto_renew: 0, annual_cost: "500.00", customer_price: "800.00",
    status: "active", notes: null, created_at: new Date(), updated_at: new Date(),
    client_name: "Cliente", client_company: null, service_domain: null, plan_name: null,
    ...overrides,
  };
}

test("domains.service.createDomain: genera un UUID v4 en la app y lo reusa en getDomainById", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [] };
    }
    assert.equal(params[0], insertParams[0], "getDomainById debe pedir el MISMO id que se insertó");
    return { rows: [fakeDomainRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  const domain = await domainsService.createDomain({
    clientId: "client-1", domain: "ejemplo.com", expirationDate: "2027-01-01",
  });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4 generado por la app");
  assert.equal(domain.id, insertParams[0]);
});

test("domains.service.createDomain: campos opcionales ausentes se envían como null, nunca undefined (mysql2 rechaza undefined)", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) { insertParams = params; return { rows: [] }; }
    return { rows: [fakeDomainRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  await domainsService.createDomain({ clientId: "client-1", domain: "ejemplo.com", expirationDate: "2027-01-01" });

  assert.ok(insertParams.every((p) => p !== undefined), "ningún parámetro debe ser undefined");
  // orden: id, clientId, hostingServiceId, domain, registrar, registrationDate, expirationDate, annualCost, customerPrice, notes, autoRenew
  assert.equal(insertParams[2], null, "hostingServiceId ausente -> null");
  assert.equal(insertParams[4], null, "registrar ausente -> null");
  assert.equal(insertParams[10], false, "autoRenew ausente -> false (default explícito preexistente)");
});

test("domains.service.getDomainById: devuelve null si no existe (no lanza, el 404 lo decide el controller)", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  const result = await domainsService.getDomainById("no-existe");

  assert.equal(result, null);
});

test("domains.service.formatDomain (vía getDomainById): auto_renew 0/1 se normaliza a boolean, igual que el boolean nativo de Postgres", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeDomainRow({ auto_renew: 1 })] }]);
  const withRenew = await domainsService.getDomainById("domain-1");
  assert.strictEqual(withRenew.autoRenew, true);

  mockPoolQueries(t, [{ rows: [fakeDomainRow({ auto_renew: 0 })] }]);
  const withoutRenew = await domainsService.getDomainById("domain-1");
  assert.strictEqual(withoutRenew.autoRenew, false);
});

test("domains.service.formatDomain: annualCost/customerPrice se parsean a Number sin el cast ::float de SQL, null se preserva", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeDomainRow({ annual_cost: "1234.56", customer_price: null })] }]);

  const result = await domainsService.getDomainById("domain-1");

  assert.strictEqual(result.annualCost, 1234.56);
  assert.strictEqual(typeof result.annualCost, "number");
  assert.strictEqual(result.customerPrice, null);
});

test("domains.service.updateDomain: sin campos para actualizar no ejecuta ningún UPDATE, solo relee el dominio", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeDomainRow()] }]); // solo getDomainById

  const result = await domainsService.updateDomain("domain-1", {});

  assert.equal(result.id, "domain-1");
});

test("domains.service.updateDomain: arma el UPDATE con placeholders `?` en el orden textual correcto", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [fakeDomainRow({ status: "expired" })] };
  };
  t.after(() => { pool.query = original; });

  await domainsService.updateDomain("domain-1", { status: "expired", autoRenew: true });

  const [updateCall] = calls;
  assert.match(updateCall.sql, /status = \?/);
  assert.match(updateCall.sql, /auto_renew = \?/);
  // orden textual real: registrar, expirationDate, autoRenew, annualCost,
  // customerPrice, status, notes (el orden en que updateDomain chequea cada
  // campo) — autoRenew aparece antes que status en el texto de la query.
  assert.deepEqual(updateCall.params, [true, "expired", "domain-1"], "el id va al final, como WHERE id = ?");
});

test("domains.service.softDeleteDomain: delega en updateDomain con status='cancelled'", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [fakeDomainRow({ status: "cancelled" })] };
  };
  t.after(() => { pool.query = original; });

  const result = await domainsService.softDeleteDomain("domain-1");

  assert.equal(result.status, "cancelled");
  assert.match(calls[0].sql, /status = \?/);
  assert.deepEqual(calls[0].params, ["cancelled", "domain-1"]);
});

test("domains.service.renewDomain: fija status='active' y la nueva fecha de vencimiento", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [fakeDomainRow({ status: "active", expiration_date: "2028-01-01" })] };
  };
  t.after(() => { pool.query = original; });

  const result = await domainsService.renewDomain("domain-1", { newExpirationDate: "2028-01-01" });

  assert.equal(result.status, "active");
  assert.equal(result.expirationDate, "2028-01-01");
  assert.match(calls[0].sql, /expiration_date = \?/);
  assert.match(calls[0].sql, /status = \?/);
});

test("domains.service.listDomains: combina filtros con placeholders en el orden textual correcto, LIMIT/OFFSET y COUNT con alias", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await domainsService.listDomains({ clientId: "client-1", status: "active", search: "acme", page: 2, limit: 10 });

  const [dataCall, countCall] = calls;
  assert.match(dataCall.sql, /d\.client_id = \?/);
  assert.match(dataCall.sql, /d\.status = \?/);
  assert.match(dataCall.sql, /LOWER\(d\.domain\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["client-1", "active", "%acme%", 10, 10]);

  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM domains d WHERE/);
  assert.deepEqual(countCall.params, ["client-1", "active", "%acme%"]);
});

test("domains.service.listDomains: expiringInDays calcula la fecha de corte en Node (sin INTERVAL parametrizado de Postgres)", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  const before = Date.now();
  await domainsService.listDomains({ expiringInDays: 7 });
  const after = Date.now();

  const [dataCall] = calls;
  assert.match(dataCall.sql, /d\.expiration_date <= \? AND d\.status != 'cancelled'/);
  const cutoff = dataCall.params[0];
  assert.ok(cutoff instanceof Date);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  assert.ok(cutoff.getTime() >= before + sevenDaysMs - 1000 && cutoff.getTime() <= after + sevenDaysMs + 1000,
    "la fecha de corte debe ser ~7 días desde ahora, calculada en Node");
});
