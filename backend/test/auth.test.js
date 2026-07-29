import { test, after } from "node:test";
import assert from "node:assert/strict";
import { authRequired } from "../src/middlewares/authRequired.js";
import pool from "../src/db/pool.js";
import app from "../src/app.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";
import { mockResponse, mockNext } from "./helpers/express-mocks.js";
import { buildAccessToken } from "./helpers/jwt.js";
import { startEphemeralServer } from "./helpers/server.js";

after(() => pool.end());

test("auth: sin token responde 401 y no llama a next", async () => {
  const req = { headers: {} };
  const res = mockResponse();
  const next = mockNext();

  await authRequired(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test("auth: token inválido/con formato incorrecto responde 401", async () => {
  const req = { headers: { authorization: "Bearer esto-no-es-un-jwt-valido" } };
  const res = mockResponse();
  const next = mockNext();

  await authRequired(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test("auth: usuario inexistente en DB responde 401", async (t) => {
  const token = buildAccessToken({ sub: "00000000-0000-0000-0000-000000000000", role: "admin" });
  mockPoolQueries(t, [{ rows: [] }]); // SELECT ... WHERE id = $1 -> sin filas

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  const next = mockNext();

  await authRequired(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test("auth: usuario inactivo responde 401 aunque el JWT sea válido", async (t) => {
  const token = buildAccessToken({ sub: "user-1", role: "admin" });
  mockPoolQueries(t, [
    { rows: [{ id: "user-1", name: "Ex Empleado", role: "admin", status: "inactive", client_id: null }] },
  ]);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  const next = mockNext();

  await authRequired(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test("auth: usuario válido y activo llama a next() con req.user completo", async (t) => {
  const token = buildAccessToken({ sub: "user-1", role: "super_admin" });
  mockPoolQueries(t, [
    { rows: [{ id: "user-1", name: "Admin Real", role: "super_admin", status: "active", client_id: null }] },
  ]);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  const next = mockNext();

  await authRequired(req, res, next);

  assert.equal(next.called, true);
  assert.deepEqual(req.user, {
    sub: "user-1",
    id: "user-1",
    name: "Admin Real",
    role: "super_admin",
    clientId: null,
  });
});

test("auth: /api/settings/company sigue protegida después de unificar el middleware", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`);
  assert.equal(res.status, 401);
});

test("auth: /api/hosting/plans (POST) sigue protegida después de unificar el middleware", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "test" }),
  });
  assert.equal(res.status, 401);
});
