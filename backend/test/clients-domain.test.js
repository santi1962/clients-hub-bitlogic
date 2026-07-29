// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio clients (Fase DB-3B): política de UUID generado en
// Node, y el patrón UPDATE+SELECT que reemplaza a UPDATE...RETURNING /
// DELETE...RETURNING en clients.service.js, sin depender de rowCount para
// decidir 404 (ver comentarios en el service). La cobertura contra un motor
// MariaDB real está en clients-mariadb.test.js — acá se prueba la lógica del
// service en aislamiento, igual que auth-users-domain.test.js para auth/users.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as clientsService from "../src/services/clients.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("clients.service.createClient: genera un UUID v4 en la app y lo reusa en el SELECT posterior", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [], rowCount: 1 };
    }
    assert.equal(params[0], insertParams[0], "el SELECT debe pedir el MISMO id que se insertó");
    return {
      rows: [{
        id: params[0], name: "Cliente Nuevo", company: null, email: "nuevo@test.com",
        phone: null, tax_id: null, status: "active", notes: null,
        created_at: new Date(), updated_at: new Date(),
      }],
      rowCount: 1,
    };
  };
  t.after(() => { pool.query = original; });

  const client = await clientsService.createClient({ name: "Cliente Nuevo", email: "nuevo@test.com" });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4 generado por la app, no DEFAULT (UUID()) de la columna");
  assert.equal(client.id, insertParams[0]);
  assert.equal(client.servicesCount, 0, "cliente recién creado no tiene servicios (mismo valor fijo que antes de esta fase, sin JOIN adicional)");
});

test("clients.service.createClient: nombre o email faltante da 400 sin llegar a tocar la DB", async (t) => {
  mockPoolQueries(t, []); // cualquier pool.query acá haría fallar el test

  await assert.rejects(
    () => clientsService.createClient({ email: "sin-nombre@test.com" }),
    (err) => err.status === 400,
  );
  await assert.rejects(
    () => clientsService.createClient({ name: "Sin Email" }),
    (err) => err.status === 400,
  );
});

test("clients.service.updateClient: SELECT vacío tras el UPDATE da 404 (no depende de rowCount)", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE clients ... (no matcheó ninguna fila)
    { rows: [] },              // SELECT posterior: no existe
  ]);

  await assert.rejects(
    () => clientsService.updateClient("no-existe", { name: "X" }),
    (err) => err.status === 404,
  );
});

test("clients.service.updateClient: camino feliz devuelve el cliente actualizado", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 1 }, // UPDATE clients
    {
      rows: [{
        id: "client-1", name: "Editado", company: "ACME", email: "editado@test.com",
        phone: null, tax_id: null, status: "active", notes: null,
        created_at: new Date(), updated_at: new Date(),
      }],
    },
  ]);

  const result = await clientsService.updateClient("client-1", { name: "Editado" });

  assert.equal(result.name, "Editado");
  assert.equal(result.id, "client-1");
});

test("clients.service.updateClient: UPDATE que no cambia ningún valor (rowCount 0 en MariaDB) pero el cliente existe no debe dar 404", async (t) => {
  // Simula el comportamiento real de mysql2 sin CLIENT_FOUND_ROWS: un UPDATE
  // cuyo COALESCE no modifica ninguna columna (ej. repetir el mismo status)
  // reporta rowCount=0 aunque el WHERE haya matcheado la fila. El service NO
  // debe usar ese rowCount para decidir 404 — debe confiar en el SELECT.
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE clients (sin cambios reales de valor)
    {
      rows: [{
        id: "client-1", name: "Sin Cambios", company: null, email: "x@test.com",
        phone: null, tax_id: null, status: "active", notes: null,
        created_at: new Date(), updated_at: new Date(),
      }],
    },
  ]);

  const result = await clientsService.updateClient("client-1", { status: "active" });

  assert.equal(result.id, "client-1", "debe devolver el cliente en vez de tirar 404 espurio");
});

test("clients.service.softDeleteClient: 404 si el cliente no existe", async (t) => {
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE clients
    { rows: [] },              // SELECT id: no existe
  ]);

  await assert.rejects(
    () => clientsService.softDeleteClient("no-existe"),
    (err) => err.status === 404,
  );
});

test("clients.service.softDeleteClient: es idempotente — repetirlo sobre un cliente ya inactive no da 404", async (t) => {
  // Mismo escenario que el test de updateClient de arriba: la segunda baja
  // sobre un cliente ya 'inactive' no cambia ningún valor -> rowCount=0 en
  // MariaDB -> el 404 se decide por el SELECT, no por ese rowCount.
  mockPoolQueries(t, [
    { rows: [], rowCount: 0 }, // UPDATE clients (ya estaba inactive, sin cambio real)
    { rows: [{ id: "client-1" }] }, // SELECT id: sigue existiendo
  ]);

  const result = await clientsService.softDeleteClient("client-1");

  assert.deepEqual(result, { id: "client-1" });
});

test("clients.service.getClientById: 404 si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  await assert.rejects(
    () => clientsService.getClientById("no-existe"),
    (err) => err.status === 404,
  );
});

test("clients.service.listClients: arma el WHERE con placeholders `?` en el mismo orden textual, combinando búsqueda y status", async (t) => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (calls.length === 1) return { rows: [] };
    return { rows: [{ count: "0" }] };
  };
  t.after(() => { pool.query = original; });

  await clientsService.listClients({ search: "acme", status: "active", page: 2, limit: 50 });

  const [dataCall, countCall] = calls;

  // 3 `?` para el LIKE (name/company/email) + 1 para status + LIMIT/OFFSET
  assert.match(dataCall.sql, /LOWER\(c\.name\) LIKE LOWER\(\?\)/);
  assert.match(dataCall.sql, /c\.status = \?/);
  assert.match(dataCall.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(dataCall.params, ["%acme%", "%acme%", "%acme%", "active", 50, 50], "offset = (page-1)*limit = 50 para page=2/limit=50");

  // La query de COUNT comparte el mismo WHERE y NO lleva LIMIT/OFFSET
  assert.match(countCall.sql, /SELECT COUNT\(\*\) AS count FROM clients c WHERE/);
  assert.deepEqual(countCall.params, ["%acme%", "%acme%", "%acme%", "active"]);
});

test("clients.service.listClients: sin filtros no agrega WHERE y no rompe el conteo", async (t) => {
  mockPoolQueries(t, [
    { rows: [] },
    { rows: [{ count: "0" }] },
  ]);

  const result = await clientsService.listClients({});

  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});
