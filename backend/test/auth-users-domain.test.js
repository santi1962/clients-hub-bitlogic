// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio auth/users (Fase DB-3A): política de UUID generado en
// Node, y el nuevo patrón transaccional que reemplaza a UPDATE...RETURNING
// en users.service.js. La cobertura contra un motor MariaDB real está en
// auth-mariadb.test.js — acá se prueba la lógica del service en aislamiento,
// igual que el resto de la suite.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import { usersService } from "../src/services/users.service.js";
import * as authService from "../src/services/auth.service.js";
import { mockPoolQueries, mockPoolConnect } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("users.service.createPortalUser: genera un UUID v4 en la app y lo reusa en el SELECT posterior", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call++;
    if (call === 1) {
      insertParams = params;
      return { rows: [], rowCount: 1 };
    }
    // segunda llamada: el SELECT de created_at debe pedir el MISMO id que se insertó
    assert.equal(params[0], insertParams[0], "el SELECT debe usar el mismo id generado en el INSERT");
    return { rows: [{ id: params[0], name: "Cliente", email: "c@test.com", status: "active", created_at: new Date() }], rowCount: 1 };
  };
  t.after(() => { pool.query = original; });

  const user = await usersService.createPortalUser({ clientId: "client-1", name: "Cliente", email: "c@test.com", password: "Password123!" });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4 generado por la app");
  assert.equal(user.id, insertParams[0]);
});

test("auth.service.forgotPassword: genera un UUID v4 explícito para password_reset_tokens (no depende de DEFAULT de la DB)", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (_sql, params) => {
    call++;
    if (call === 1) return { rows: [{ id: "user-1" }], rowCount: 1 }; // SELECT id FROM users WHERE email
    insertParams = params; // INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
    return { rows: [], rowCount: 1 };
  };
  t.after(() => { pool.query = original; });

  await authService.forgotPassword("test@test.com");

  assert.match(insertParams[0], UUID_V4, "el id del token de reset debe ser un UUID v4 generado por la app");
  assert.equal(insertParams[1], "user-1");
});

test("users.service.resetPassword: UPDATE con rowCount 0 hace ROLLBACK y no llega a revocar refresh tokens", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },   // BEGIN
    { rows: [], rowCount: 0 },   // UPDATE users ... -> no encontró la fila
    { rows: [], rowCount: 1 },   // ROLLBACK
  ]);

  await assert.rejects(
    () => usersService.resetPassword("no-existe", "NuevaPass123!"),
    (err) => err.status === 404,
  );

  assert.equal(queries.length, 3, "no debe llegar a ejecutar la revocación de refresh_tokens ni el SELECT final");
  assert.match(queries[0], /^BEGIN$/);
  assert.match(queries[1], /UPDATE users/);
  assert.match(queries[2], /^ROLLBACK$/);
});

test("users.service.resetPassword: camino feliz revoca refresh tokens y hace COMMIT", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },                                        // BEGIN
    { rows: [], rowCount: 1 },                                        // UPDATE users
    { rows: [], rowCount: 1 },                                        // UPDATE refresh_tokens
    { rows: [{ id: "user-1", name: "Cliente", email: "c@test.com" }], rowCount: 1 }, // SELECT
    { rows: [], rowCount: 1 },                                        // COMMIT
  ]);

  const result = await usersService.resetPassword("user-1", "NuevaPass123!");

  assert.equal(queries.length, 5);
  assert.match(queries[1], /UPDATE users/);
  assert.match(queries[2], /UPDATE refresh_tokens/);
  assert.match(queries[3], /SELECT/);
  assert.match(queries[4], /^COMMIT$/);
  assert.deepEqual(result, { id: "user-1", name: "Cliente", email: "c@test.com" });
});

test("users.service.deletePortalUser: rowCount 0 da 404 sin necesitar una query adicional", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);

  await assert.rejects(
    () => usersService.deletePortalUser("no-existe"),
    (err) => err.status === 404,
  );
});

test("users.service.deletePortalUser: rowCount 1 devuelve el id sin round-trip extra (no hay RETURNING en MariaDB)", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 1 }]);

  const result = await usersService.deletePortalUser("user-1");

  assert.deepEqual(result, { id: "user-1" });
});
