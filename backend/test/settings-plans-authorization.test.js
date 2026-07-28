import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import app from "../src/app.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";
import { buildAccessToken } from "./helpers/jwt.js";
import { startEphemeralServer } from "./helpers/server.js";

after(() => pool.end());

/**
 * Política real aplicada (ver docs/PRODUCTION_STATUS.md):
 *  - Configuración (billing/hosting/payments/email/readiness, y escritura
 *    de company/logo): exclusiva de super_admin, igual que ya asume el
 *    frontend (PERMISSIONS["configuracion"] en src/lib/auth.tsx).
 *  - Lectura de company: además de Configuración, la usa la página Avisos
 *    (super_admin + admin + finanzas) → requireFinancial.
 *  - Plantillas (email templates): página separada, super_admin + admin →
 *    requireAdmin.
 *  - Planes: lectura pública (la consume el portal del cliente y otras
 *    pantallas de servicios) — sin restricción de rol. Mutaciones
 *    (crear/editar/eliminar) exclusivas de super_admin.
 */

function userRow(role, overrides = {}) {
  return {
    id: "user-1",
    name: "Usuario de prueba",
    role,
    status: "active",
    client_id: null,
    ...overrides,
  };
}

function tokenFor(role, extra = {}) {
  return buildAccessToken({ sub: "user-1", role, ...extra });
}

// ── SETTINGS ──────────────────────────────────────────────────

test("settings: GET /company sin token responde 401", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);
  const res = await fetch(`${baseUrl}/api/settings/company`);
  assert.equal(res.status, 401);
});

test("settings: GET /company con rol cliente responde 403 con requestId", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("cliente")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    headers: { Authorization: `Bearer ${tokenFor("cliente")}` },
  });
  const body = await res.json();

  assert.equal(res.status, 403);
  assert.ok(body.requestId, "el 403 debe incluir requestId");
  assert.equal(body.error.message, "Acceso denegado: permiso insuficiente");
});

test("settings: GET /company con rol finanzas (staff) es permitido", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("finanzas")] }, { rows: [{ company_name: "Bitlogic" }] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    headers: { Authorization: `Bearer ${tokenFor("finanzas")}` },
  });
  assert.equal(res.status, 200);
});

test("settings: PUT /company con rol finanzas (staff) es rechazado con 403", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("finanzas")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenFor("finanzas")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Bitlogic" }),
  });
  assert.equal(res.status, 403);
});

test("settings: GET /company con rol admin es permitido (lo usa la página Avisos)", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("admin")] }, { rows: [{ company_name: "Bitlogic" }] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    headers: { Authorization: `Bearer ${tokenFor("admin")}` },
  });
  assert.equal(res.status, 200);
});

test("settings: PUT /company con rol admin es rechazado con 403 (solo super_admin escribe Configuración)", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("admin")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenFor("admin")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Bitlogic" }),
  });
  assert.equal(res.status, 403);
});

test("settings: PUT /company con rol super_admin es permitido y audita al usuario real", async (t) => {
  const auditCalls = [];
  mockPoolQueries(t, [
    { rows: [userRow("super_admin", { name: "Super Admin Real" })] }, // authRequired
    { rows: [{ id: "cfg-1", company_name: "Bitlogic SRL" }] }, // upsert de settings
    { rows: [{ id: "audit-1" }] }, // insert de audit_logs
  ]);

  // Interceptamos la query del audit log específicamente para inspeccionar
  // qué user_id/user_name se graba, sin depender del orden exacto de columnas.
  const original = pool.query;
  let auditParams = null;
  pool.query = async (sql, params) => {
    if (typeof sql === "string" && sql.includes("INSERT INTO audit_logs")) {
      auditParams = params;
      return { rows: [{ id: "audit-1" }] };
    }
    return original.call(pool, sql, params).catch(() => ({ rows: [{ id: "cfg-1", company_name: "Bitlogic SRL" }] }));
  };
  t.after(() => {
    pool.query = original;
  });

  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenFor("super_admin")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ companyName: "Bitlogic SRL" }),
  });

  assert.equal(res.status, 200);
  assert.ok(auditParams, "debería haberse llamado al insert de audit_logs");
  assert.equal(auditParams[0], "user-1", "user_id debe ser el usuario real, no null");
  assert.equal(auditParams[1], "Super Admin Real", "user_name debe ser el usuario real, no System");
  assert.notEqual(auditParams[1], "System");
});

test("settings: GET /templates con rol admin es permitido (Plantillas es super_admin+admin)", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("admin")] }, { rows: [{ id: "venc", subject: "x", body: "y" }] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/templates`, {
    headers: { Authorization: `Bearer ${tokenFor("admin")}` },
  });
  assert.equal(res.status, 200);
});

test("settings: GET /templates con rol finanzas es rechazado con 403", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("finanzas")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/templates`, {
    headers: { Authorization: `Bearer ${tokenFor("finanzas")}` },
  });
  assert.equal(res.status, 403);
});

test("settings: usuario inactivo responde 401 antes de llegar a la verificación de rol", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("super_admin", { status: "inactive" })] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/settings/company`, {
    headers: { Authorization: `Bearer ${tokenFor("super_admin")}` },
  });
  assert.equal(res.status, 401);
});

// ── PLANS ─────────────────────────────────────────────────────

test("plans: POST /hosting/plans sin token responde 401", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);
  const res = await fetch(`${baseUrl}/api/hosting/plans`, { method: "POST" });
  assert.equal(res.status, 401);
});

test("plans: POST /hosting/plans con rol cliente responde 403", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("cliente")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor("cliente")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Plan X", monthlyPrice: 1000 }),
  });
  assert.equal(res.status, 403);
});

test("plans: GET /hosting/plans (listado) no requiere rol especial — lo usa el portal del cliente", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]); // plansService.listPlans
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  // Sin token en absoluto — igual que hoy, el listado de planes es de lectura pública.
  const res = await fetch(`${baseUrl}/api/hosting/plans`);
  assert.equal(res.status, 200);
});

test("plans: GET /hosting/plans con un token real de rol cliente también funciona (no rompe el portal)", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans`, {
    headers: { Authorization: `Bearer ${tokenFor("cliente")}` },
  });
  assert.equal(res.status, 200);
});

test("plans: POST /hosting/plans con rol admin es rechazado con 403 (mutaciones son solo super_admin)", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("admin")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor("admin")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Plan X", monthlyPrice: 1000 }),
  });
  assert.equal(res.status, 403);
});

test("plans: POST /hosting/plans con rol super_admin es permitido", async (t) => {
  mockPoolQueries(t, [
    { rows: [userRow("super_admin")] },
    { rows: [{ id: "plan-1", name: "Plan Pro", monthly_price: 5000 }] }, // createPlan insert
    { rows: [{ id: "audit-1" }] }, // audit log
  ]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor("super_admin")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Plan Pro", monthlyPrice: 5000 }),
  });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.name, "Plan Pro");
});

test("plans: DELETE /hosting/plans/:id con rol admin es rechazado con 403", async (t) => {
  mockPoolQueries(t, [{ rows: [userRow("admin")] }]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/hosting/plans/plan-1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenFor("admin")}` },
  });
  assert.equal(res.status, 403);
});

// ── PORTAL: confirmar que sigue intacto ──────────────────────────

test("portal: un cliente sigue pudiendo usar /api/portal/me sin verse afectado por los cambios de roles", async (t) => {
  mockPoolQueries(t, [
    { rows: [userRow("cliente", { client_id: "client-1" })] },
    { rows: [{ id: "client-1", name: "Cliente Real" }] },
  ]);
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const res = await fetch(`${baseUrl}/api/portal/me`, {
    headers: { Authorization: `Bearer ${tokenFor("cliente", { clientId: "client-1" })}` },
  });
  assert.equal(res.status, 200);
});
