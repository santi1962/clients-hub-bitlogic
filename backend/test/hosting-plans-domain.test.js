// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio hosting_plans/hosting_services (Fase DB-3C): UUID v4
// generado en la app, patrón UPDATE+SELECT que reemplaza a UPDATE...RETURNING
// (decidiendo 404 por SELECT y no por rowCount solo donde hace falta —
// updatePlan/updateService/changeServicePlan pueden dejar todos los valores
// iguales; suspendService/reactivateService no, porque su WHERE excluye el
// estado ya alcanzado), y placeholders `?` de los WHERE dinámicos. La
// cobertura contra un motor MariaDB real está en hosting-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as plansService from "../src/services/plans.service.js";
import * as hostingService from "../src/services/hosting.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakePlanRow(overrides = {}) {
  return {
    id: "plan-1", name: "Pro", description: null, storage_gb: 15,
    websites_limit: 3, emails_limit: 20, monthly_price: "18.00", status: "active",
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

// ── plans.service.js ─────────────────────────────────────────────

test("plans.service.createPlan: genera un UUID v4 en la app y lo reusa en el SELECT posterior", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [] };
    }
    assert.equal(params[0], insertParams[0], "el SELECT debe pedir el MISMO id que se insertó");
    return { rows: [fakePlanRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  const plan = await plansService.createPlan({ name: "Pro", monthlyPrice: 18 });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4, no uuidv4() del paquete uuid ni DEFAULT (UUID())");
  assert.equal(plan.id, insertParams[0]);
});

test("plans.service.updatePlan: SELECT vacío tras el UPDATE da 404 (no depende de rowCount)", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE hosting_plans
    { rows: [] },              // SELECT posterior: no existe
  ]);

  await assert.rejects(
    () => plansService.updatePlan("no-existe", { name: "X" }),
    (err) => err.status === 404,
  );
});

test("plans.service.updatePlan: PATCH que no cambia ningún valor (rowCount 0 en MariaDB) no debe dar 404 si el plan existe", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE sin cambios reales de valor
    { rows: [fakePlanRow({ monthly_price: "18.00" })] },
  ]);

  const result = await plansService.updatePlan("plan-1", { monthlyPrice: 18 });

  assert.equal(result.id, "plan-1");
});

test("plans.service.updatePlan: sin campos para actualizar devuelve el plan tal cual (no ejecuta UPDATE)", async (t) => {
  mockPoolQueries(t, [{ rows: [fakePlanRow()] }]); // solo getPlanById

  const result = await plansService.updatePlan("plan-1", {});

  assert.equal(result.id, "plan-1");
});

test("plans.service.deletePlan: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => plansService.deletePlan("no-existe"),
    (err) => err.status === 404,
  );
});

test("plans.service.deletePlan: rowCount 1 no lanza error (DELETE real, sin ambigüedad de valores)", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 1 }]);

  await assert.doesNotReject(() => plansService.deletePlan("plan-1"));
});

test("plans.service.listPlans: LIMIT como placeholder `?`, no concatenado a mano", async (t) => {
  const original = pool.query;
  let captured;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [] };
  };
  t.after(() => { pool.query = original; });

  await plansService.listPlans({ status: "active", limit: 50 });

  assert.match(captured.sql, /WHERE status = \?/);
  assert.match(captured.sql, /LIMIT \?$/);
  assert.deepEqual(captured.params, ["active", 50]);
});

// ── hosting.service.js: plans (código vivo internamente, inalcanzable por HTTP) ──

test("hosting.service.createPlan: genera un UUID v4 en la app y lo reusa en el SELECT posterior", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [] };
    }
    return { rows: [fakePlanRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  const plan = await hostingService.createPlan({ name: "Pro", storageGb: 15, monthlyPrice: 18 });

  assert.match(insertParams[0], UUID_V4);
  assert.equal(plan.id, insertParams[0]);
});

// ── hosting.service.js: services ─────────────────────────────────

test("hosting.service.createService: genera un UUID v4 y lo reusa en getServiceById", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call++;
    if (call === 1) return { rows: [{ storage_gb: 15, emails_limit: 20 }] }; // lookup del plan
    if (call === 2) {
      insertParams = params;
      return { rows: [] }; // INSERT
    }
    // getServiceById -> SERVICE_SELECT WHERE hs.id = ?
    assert.equal(params[0], insertParams[0], "getServiceById debe pedir el MISMO id que se insertó");
    return {
      rows: [{
        id: params[0], client_id: "client-1", plan_id: "plan-1", domain: "test.com",
        status: "active", monthly_price: "18.00", setup_date: new Date(), next_due_date: new Date(),
        storage_used_gb: "0.00", storage_total_gb: "15.00", emails_used: 0, emails_total: 20,
        hestia_username: null, hestia_url: null, internal_notes: null, created_at: new Date(),
        client_name: "Cliente", client_company: null, plan_name: "Pro", plan_storage_gb: 15, plan_emails_limit: 20,
      }],
    };
  };
  t.after(() => { pool.query = original; });

  const service = await hostingService.createService({
    clientId: "client-1", planId: "plan-1", domain: "test.com",
    monthlyPrice: 18, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
  });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4, no DEFAULT (UUID())");
  assert.equal(service.id, insertParams[0]);
});

test("hosting.service.updateService: SELECT vacío tras el UPDATE da 404 (no depende de rowCount)", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE hosting_services
    { rows: [] },              // SELECT id: no existe
  ]);

  await assert.rejects(
    () => hostingService.updateService("no-existe", { status: "active" }),
    (err) => err.status === 404,
  );
});

test("hosting.service.updateService: PATCH sin cambios reales de valor (rowCount 0 en MariaDB) no debe dar 404", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, _params) => {
    call++;
    if (call === 1) return { rows: [], rowCount: 0 }; // UPDATE sin cambios reales
    if (call === 2) return { rows: [{ id: "service-1" }] }; // SELECT id: existe
    // getServiceById
    return {
      rows: [{
        id: "service-1", client_id: "client-1", plan_id: "plan-1", domain: "test.com",
        status: "active", monthly_price: "18.00", setup_date: new Date(), next_due_date: new Date(),
        storage_used_gb: "0.00", storage_total_gb: "15.00", emails_used: 0, emails_total: 20,
        created_at: new Date(),
      }],
    };
  };
  t.after(() => { pool.query = original; });

  const result = await hostingService.updateService("service-1", { status: "active" });

  assert.equal(result.id, "service-1", "no debe tirar 404 espurio");
});

test("hosting.service.deleteService: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => hostingService.deleteService("no-existe"),
    (err) => err.status === 404,
  );
});

test("hosting.service.deleteService: rowCount 1 no lanza error", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 1 }]);

  await assert.doesNotReject(() => hostingService.deleteService("service-1"));
});

test("hosting.service.suspendService: 404 si no existe o ya estaba suspendido (rowCount 0 es semánticamente correcto acá)", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => hostingService.suspendService("service-1"),
    (err) => err.status === 404 && /ya suspendido/.test(err.message),
  );
});

test("hosting.service.reactivateService: 404 si no existe o no estaba suspendido", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => hostingService.reactivateService("service-1"),
    (err) => err.status === 404 && /no está suspendido/.test(err.message),
  );
});

test("hosting.service.changeServicePlan: reasignar el MISMO plan (sin cambios reales de valor) no debe dar 404 espurio", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, _params) => {
    call++;
    if (call === 1) return { rows: [fakePlanRow({ id: "plan-1" })] }; // getPlanById (verificación de existencia)
    if (call === 2) return { rows: [{ storage_gb: 15, emails_limit: 20, monthly_price: "18.00" }] }; // lookup de recursos
    if (call === 3) return { rows: [], rowCount: 0 }; // UPDATE sin cambios reales (mismo plan de antes)
    if (call === 4) return { rows: [{ id: "service-1" }] }; // SELECT id: existe
    return {
      rows: [{
        id: "service-1", client_id: "client-1", plan_id: "plan-1", domain: "test.com",
        status: "active", monthly_price: "18.00", setup_date: new Date(), next_due_date: new Date(),
        storage_used_gb: "0.00", storage_total_gb: "15.00", emails_used: 0, emails_total: 20,
        created_at: new Date(),
      }],
    };
  };
  t.after(() => { pool.query = original; });

  const result = await hostingService.changeServicePlan("service-1", "plan-1");

  assert.equal(result.id, "service-1");
});

test("hosting.service.changeServicePlan: 404 si el servicio no existe", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, _params) => {
    call++;
    if (call === 1) return { rows: [fakePlanRow({ id: "plan-1" })] };
    if (call === 2) return { rows: [{ storage_gb: 15, emails_limit: 20, monthly_price: "18.00" }] };
    if (call === 3) return { rows: [], rowCount: 0 };
    return { rows: [] }; // SELECT id: no existe
  };
  t.after(() => { pool.query = original; });

  await assert.rejects(
    () => hostingService.changeServicePlan("no-existe", "plan-1"),
    (err) => err.status === 404,
  );
});

test("hosting.service.listServices: búsqueda combina LOWER()/LIKE con placeholders en orden textual y COUNT con alias", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await hostingService.listServices({ status: "active", search: "acme", page: 1, limit: 25 });

  const [dataCall, countCall] = calls;
  assert.match(dataCall.sql, /LOWER\(hs\.domain\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /hs\.status\s+= \?/);
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["active", "%acme%", "%acme%", "%acme%", 25, 0]);

  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM hosting_services/);
  assert.deepEqual(countCall.params, ["active", "%acme%", "%acme%", "%acme%"]);
});
