// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio Tasks (Fase DB-3G): UUID v4 generado en la app,
// placeholders `?`, patrón UPDATE+SELECT (decidiendo 404 por SELECT, no por
// rowCount) para updateTask/completeTask/reopenTask, rowCount confiable para
// deleteTask (DELETE real), y el ORDER BY (due_date IS NULL) que reemplaza
// NULLS LAST (exclusivo de Postgres). La cobertura contra un motor MariaDB
// real está en tasks-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import { tasksService } from "../src/services/tasks.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeTaskRow(overrides = {}) {
  return {
    id: "task-1", title: "Revisar backup", description: null, status: "pending", priority: "normal",
    assigned_to: null, created_by: "user-1", client_id: null, hosting_service_id: null,
    domain_id: null, support_ticket_id: null, due_date: null, completed_at: null,
    created_at: new Date(), updated_at: new Date(),
    client_name: null, client_company: null, service_domain: null, domain_name: null,
    ticket_number: null, assigned_user_name: null,
    ...overrides,
  };
}

test("tasksService.createTask: genera un UUID v4 en la app y lo reusa en el SELECT posterior", async (t) => {
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
    return { rows: [fakeTaskRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = original; });

  const task = await tasksService.createTask({ title: "Revisar backup" });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4, no DEFAULT (UUID())");
  assert.equal(task.id, insertParams[0]);
});

test("tasksService.getTask: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  await assert.rejects(
    () => tasksService.getTask("no-existe"),
    (err) => err.status === 404,
  );
});

test("tasksService.updateTask: SELECT vacío tras el UPDATE da 404 (no depende de rowCount)", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE internal_tasks
    { rows: [] },              // SELECT id: no existe
  ]);

  await assert.rejects(
    () => tasksService.updateTask("no-existe", { priority: "high" }),
    (err) => err.status === 404,
  );
});

test("tasksService.updateTask: PATCH sin cambios reales de valor (rowCount 0 en MariaDB) no debe dar 404", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async () => {
    call++;
    if (call === 1) return { rows: [], rowCount: 0 }; // UPDATE sin cambios reales
    if (call === 2) return { rows: [{ id: "task-1" }] }; // SELECT id: existe
    return { rows: [fakeTaskRow()] }; // getTask
  };
  t.after(() => { pool.query = original; });

  const result = await tasksService.updateTask("task-1", { priority: "normal" });

  assert.equal(result.id, "task-1", "no debe tirar 404 espurio");
});

test("tasksService.updateTask: sin campos permitidos delega en getTask sin ejecutar UPDATE", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeTaskRow()] }]);

  const result = await tasksService.updateTask("task-1", { unknownField: "x" });

  assert.equal(result.id, "task-1");
});

test("tasksService.deleteTask: 404 si no existe (getTask previo ya falla)", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]); // getTask -> no existe

  await assert.rejects(
    () => tasksService.deleteTask("no-existe"),
    (err) => err.status === 404,
  );
});

test("tasksService.deleteTask: devuelve la tarea completa que existía antes de borrarla (RETURNING * emulado)", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async () => {
    call++;
    if (call === 1) return { rows: [fakeTaskRow({ title: "Tarea a borrar" })] }; // getTask
    return { rows: [], rowCount: 1 }; // DELETE
  };
  t.after(() => { pool.query = original; });

  const result = await tasksService.deleteTask("task-1");

  assert.equal(result.title, "Tarea a borrar", "debe devolver la fila completa, no solo el id");
});

test("tasksService.completeTask: setea status=completed y completed_at", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [], rowCount: 1 };
    if (calls.length === 2) return { rows: [{ id: "task-1" }] };
    return { rows: [fakeTaskRow({ status: "completed" })] };
  };
  t.after(() => { pool.query = original; });

  const result = await tasksService.completeTask("task-1");

  assert.match(calls[0].sql, /status = 'completed'/);
  assert.match(calls[0].sql, /completed_at = now\(\)/);
  assert.equal(result.status, "completed");
});

test("tasksService.reopenTask: setea status=pending y completed_at=null", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [], rowCount: 1 };
    if (calls.length === 2) return { rows: [{ id: "task-1" }] };
    return { rows: [fakeTaskRow({ status: "pending", completed_at: null })] };
  };
  t.after(() => { pool.query = original; });

  const result = await tasksService.reopenTask("task-1");

  assert.match(calls[0].sql, /status = 'pending'/);
  assert.match(calls[0].sql, /completed_at = null/);
  assert.equal(result.status, "pending");
  assert.equal(result.completed_at, null);
});

test("tasksService.listTasks: combina filtros con placeholders `?`, búsqueda LOWER()/LIKE en title/description, ORDER BY sin NULLS LAST, y COUNT con alias", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await tasksService.listTasks({ status: "pending", search: "backup", page: 1, limit: 20 });

  const [dataCall, countCall] = calls;
  assert.match(dataCall.sql, /t\.status = \?/);
  assert.match(dataCall.sql, /LOWER\(t\.title\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /LOWER\(t\.description\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /ORDER BY \(t\.due_date IS NULL\), t\.due_date ASC/);
  assert.doesNotMatch(dataCall.sql, /NULLS LAST/, "no debe quedar sintaxis exclusiva de Postgres");
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["pending", "%backup%", "%backup%", 20, 0]);

  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM internal_tasks t WHERE/);
  assert.deepEqual(countCall.params, ["pending", "%backup%", "%backup%"]);
});
