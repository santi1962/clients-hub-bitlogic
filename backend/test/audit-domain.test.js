// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del subsistema audit_logs (Fase DB-3D): UUID v4 generado en la
// app, placeholders `?`, política best-effort ante fallo del INSERT (con
// logger estructurado + requestId en vez del console.error crudo anterior),
// y el fix del doble-parseo de JSON en getLogById (bug preexistente: `pg`
// ya deserializa jsonb a objeto, un JSON.parse() incondicional sobre eso
// revienta). La cobertura contra un motor MariaDB real está en
// audit-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import { auditService } from "../src/services/audit.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("audit.service.logAction: genera un UUID v4 en la app, no depende de DEFAULT (UUID())", async (t) => {
  let insertParams;
  const original = pool.query;
  pool.query = async (_sql, params) => {
    insertParams = params;
    return { rows: [] };
  };
  t.after(() => { pool.query = original; });

  await auditService.logAction({
    user: { id: "user-1", name: "Admin", role: "admin" },
    action: "crear",
    entityType: "cliente",
    entityId: "client-1",
  });

  assert.match(insertParams[0], UUID_V4, "el primer parámetro (id) debe ser un UUID v4 generado por la app");
});

test("audit.service.logAction: user_id/user_name/user_role correctos, y 'System'/'system' cuando no hay user", async (t) => {
  let paramsWithUser, paramsWithoutUser;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) paramsWithUser = params;
    else paramsWithoutUser = params;
    return { rows: [] };
  };
  t.after(() => { pool.query = original; });

  await auditService.logAction({
    user: { id: "user-1", name: "Cliente Real", role: "super_admin" },
    action: "editar", entityType: "cliente", entityId: "client-1",
  });
  await auditService.logAction({ action: "sync", entityType: "servicio", entityId: "svc-1" });

  // orden de columnas: id, user_id, user_name, user_role, action, ...
  assert.equal(paramsWithUser[1], "user-1");
  assert.equal(paramsWithUser[2], "Cliente Real");
  assert.equal(paramsWithUser[3], "super_admin");

  assert.equal(paramsWithoutUser[1], null, "sin user, user_id debe ser null (respeta la FK ON DELETE SET NULL)");
  assert.equal(paramsWithoutUser[2], "System");
  assert.equal(paramsWithoutUser[3], "system");
});

test("audit.service.logAction: old_values/new_values null cuando no se pasan", async (t) => {
  let insertParams;
  const original = pool.query;
  pool.query = async (_sql, params) => { insertParams = params; return { rows: [] }; };
  t.after(() => { pool.query = original; });

  await auditService.logAction({ action: "eliminar", entityType: "plan_hosting", entityId: "plan-1" });

  // orden: id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, old_values, new_values, ip, ua
  assert.equal(insertParams[8], null);
  assert.equal(insertParams[9], null);
});

test("audit.service.logAction: old_values/new_values se guardan como JSON.stringify (compatible con jsonb de Postgres y JSON de MariaDB)", async (t) => {
  let insertParams;
  const original = pool.query;
  pool.query = async (_sql, params) => { insertParams = params; return { rows: [] }; };
  t.after(() => { pool.query = original; });

  await auditService.logAction({
    action: "editar", entityType: "cliente", entityId: "client-1",
    oldValues: { status: "active" }, newValues: { status: "inactive", nota: "reactivación pendiente — ó/ñ/emoji 🎉" },
  });

  assert.equal(insertParams[8], JSON.stringify({ status: "active" }));
  assert.equal(insertParams[9], JSON.stringify({ status: "inactive", nota: "reactivación pendiente — ó/ñ/emoji 🎉" }));
});

test("audit.service.logAction: un fallo del INSERT no se propaga (best-effort) y queda logueado con requestId", async (t) => {
  mockPoolQueries(t, [new Error("Table 'audit_logs' doesn't exist")]);

  const originalConsoleError = console.error;
  const logLines = [];
  console.error = (line) => logLines.push(line);
  t.after(() => { console.error = originalConsoleError; });

  await assert.doesNotReject(
    () => auditService.logAction({
      requestId: "req-abc-123",
      user: { id: "user-1", name: "Admin", role: "admin" },
      action: "crear", entityType: "cliente", entityId: "client-1",
    }),
    "logAction nunca debe rechazar — una acción de negocio ya completada no debe verse afectada por un fallo de auditoría",
  );

  assert.equal(logLines.length, 1, "el fallo debe quedar registrado exactamente una vez (sin duplicar el intento de insert)");
  const entry = JSON.parse(logLines[0]);
  assert.equal(entry.level, "error");
  assert.equal(entry.module, "audit-service");
  assert.equal(entry.requestId, "req-abc-123", "el requestId debe propagarse al log estructurado");
  assert.match(entry.error, /doesn't exist/);
  assert.equal(entry.action, "crear");
  assert.equal(entry.entityType, "cliente");
  assert.equal(entry.entityId, "client-1");
});

test("audit.service.logAction: si el contexto de auditoría trajera una clave sensible, el logger la redacta automáticamente (sin sanitización nueva)", async (t) => {
  mockPoolQueries(t, [new Error("boom")]);

  const originalConsoleError = console.error;
  const logLines = [];
  console.error = (line) => logLines.push(line);
  t.after(() => { console.error = originalConsoleError; });

  // logAction no acepta ni loguea oldValues/newValues en el log de error (ver
  // la lista explícita de campos en audit.service.js) — este test confirma
  // esa política: ni siquiera se necesita redacción para el objeto de log,
  // porque los valores de negocio nunca entran en él. Documentado, no
  // "arreglado": no se agregó sanitización nueva sobre lo que SÍ se persiste
  // en la fila de audit_logs (oldValues/newValues), eso queda igual que
  // antes de esta fase.
  await auditService.logAction({
    requestId: "req-1", action: "crear", entityType: "cliente", entityId: "client-1",
    oldValues: { password: "no-deberia-viajar-al-log" },
  });

  const entry = JSON.parse(logLines[0]);
  assert.ok(!("oldValues" in entry) && !JSON.stringify(entry).includes("no-deberia-viajar-al-log"),
    "el log de error de auditoría nunca debe incluir oldValues/newValues, sensibles o no");
});

test("audit.service.getLogById: old_values ya viene como objeto (jsonb de Postgres) — no debe intentar JSON.parse sobre un objeto", async (t) => {
  mockPoolQueries(t, [{
    rows: [{
      id: "log-1", user_id: "user-1", user_name: "Admin", user_role: "admin",
      action: "editar", entity_type: "cliente", entity_id: "client-1", entity_name: "ACME",
      old_values: { status: "active" }, new_values: { status: "inactive" },
      ip_address: null, user_agent: null, created_at: new Date(),
    }],
  }]);

  const result = await auditService.getLogById("log-1");

  assert.deepEqual(result.oldValues, { status: "active" });
  assert.deepEqual(result.newValues, { status: "inactive" });
});

test("audit.service.getLogById: old_values viene como string (JSON de MariaDB) — se parsea", async (t) => {
  mockPoolQueries(t, [{
    rows: [{
      id: "log-1", user_id: "user-1", user_name: "Admin", user_role: "admin",
      action: "editar", entity_type: "cliente", entity_id: "client-1", entity_name: "ACME",
      old_values: JSON.stringify({ status: "active" }), new_values: JSON.stringify({ status: "inactive" }),
      ip_address: null, user_agent: null, created_at: new Date(),
    }],
  }]);

  const result = await auditService.getLogById("log-1");

  assert.deepEqual(result.oldValues, { status: "active" });
  assert.deepEqual(result.newValues, { status: "inactive" });
});

test("audit.service.getLogById: old_values/new_values null no rompe", async (t) => {
  mockPoolQueries(t, [{
    rows: [{
      id: "log-1", user_id: null, user_name: "System", user_role: "system",
      action: "crear", entity_type: "plan_hosting", entity_id: "plan-1", entity_name: null,
      old_values: null, new_values: null, ip_address: null, user_agent: null, created_at: new Date(),
    }],
  }]);

  const result = await auditService.getLogById("log-1");

  assert.equal(result.oldValues, null);
  assert.equal(result.newValues, null);
});

test("audit.service.getLogById: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  await assert.rejects(
    () => auditService.getLogById("no-existe"),
    (err) => err.status === 404,
  );
});

test("audit.service.listLogs: combina filtros con placeholders `?` en el orden textual correcto y COUNT con alias", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await auditService.listLogs({ entityType: "cliente", action: "crear", page: 2, limit: 20 });

  const [dataCall, countCall] = calls;
  assert.match(dataCall.sql, /entity_type = \?/);
  assert.match(dataCall.sql, /action = \?/);
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["cliente", "crear", 20, 20]);

  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM audit_logs WHERE/);
  assert.deepEqual(countCall.params, ["cliente", "crear"]);
});

test("audit.service.getRecentActivity: LIMIT como placeholder `?`", async (t) => {
  const original = pool.query;
  let captured;
  pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [] }; };
  t.after(() => { pool.query = original; });

  await auditService.getRecentActivity(5);

  assert.match(captured.sql, /LIMIT \?$/);
  assert.deepEqual(captured.params, [5]);
});
