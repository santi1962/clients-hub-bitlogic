// Fixture ejecutado en un proceso hijo separado por auth-mariadb.test.js,
// con DATABASE_URL ya apuntando a la MariaDB descartable ANTES de que este
// proceso importe nada — así db/pool.js/config/index.js (que leen
// DATABASE_URL una sola vez, al importarse) arrancan con el driver mysql2
// real desde el principio. El mismo patrón que ya usa config.test.js con
// fixtures/load-config.mjs, aplicado acá a un flujo HTTP completo.
//
// GUARD IMPORTANTE: `node --test` (sin ningún patrón explícito, ver
// package.json) descubre por defecto cualquier .js/.mjs bajo un directorio
// llamado "test" en cualquier profundidad — incluye este archivo aunque
// viva en fixtures/, igual que ya le pasa a load-config.mjs y
// scheduler-init.mjs. Esos dos son inofensivos si se corren sueltos (solo
// leen config / registran cron una vez); este NO lo es, porque escribe
// datos reales. Sin este guard, correrlo suelto (sin pasar por
// auth-mariadb.test.js) escribiría contra el DATABASE_URL que sea que esté
// ambiente en ese momento — incluida, potencialmente, una base real. El
// orquestador marca MARIADB_FIXTURE_RUN=1 antes de invocarlo; si falta, no
// se hace nada.
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import pool from "../../src/db/pool.js";
import { startEphemeralServer } from "../helpers/server.js";

const PASSWORD = "Password123!";

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const clientId = randomUUID();
  const superAdminId = randomUUID();
  const adminId = randomUUID();
  const clienteId = randomUUID();
  const inactiveId = randomUUID();

  await pool.query(`INSERT INTO clients (id, name, email) VALUES (?, ?, ?)`, [
    clientId,
    "Cliente Fixture",
    "clientefixture@test.com",
  ]);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status, client_id) VALUES
     (?, 'Super Admin Fixture', 'superadmin@fixture.test', ?, 'super_admin', 'active', NULL),
     (?, 'Admin Fixture', 'admin@fixture.test', ?, 'admin', 'active', NULL),
     (?, 'Cliente Fixture User', 'cliente@fixture.test', ?, 'cliente', 'active', ?),
     (?, 'Inactivo Fixture', 'inactivo@fixture.test', ?, 'admin', 'inactive', NULL)`,
    [
      superAdminId, passwordHash,
      adminId, passwordHash,
      clienteId, passwordHash, clientId,
      inactiveId, passwordHash,
    ],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── login ──────────────────────────────────────────────
    const loginOk = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@fixture.test", password: PASSWORD }),
    });
    assert.equal(loginOk.status, 200, "login válido debe dar 200");
    const loginBody = await loginOk.json();
    assert.equal(typeof loginBody.accessToken, "string");
    assert.deepEqual(loginBody.user.notifications, {
      emailPayments: true, emailTickets: true, whatsapp: false, weeklyReport: true,
    }, "notifications debe llegar como objeto, no como string JSON crudo");
    const refreshCookie = loginOk.headers.get("set-cookie")?.match(/refresh_token=([^;]+)/)?.[1];
    assert.ok(refreshCookie, "debe setear cookie refresh_token");

    const loginWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@fixture.test", password: "incorrecta123" }),
    });
    assert.equal(loginWrongPass.status, 401, "contraseña incorrecta debe dar 401");

    const loginNoUser = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "noexiste@fixture.test", password: PASSWORD }),
    });
    assert.equal(loginNoUser.status, 401, "usuario inexistente debe dar 401");

    const loginInactive = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "inactivo@fixture.test", password: PASSWORD }),
    });
    assert.equal(loginInactive.status, 401, "usuario inactivo debe dar 401");

    // ── refresh ────────────────────────────────────────────
    const refreshOk = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshCookie}` },
    });
    assert.equal(refreshOk.status, 200, "refresh válido debe dar 200");

    // ── logout revoca el refresh token en DB ──────────────
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshCookie}` },
    });
    const refreshAfterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshCookie}` },
    });
    assert.equal(refreshAfterLogout.status, 401, "refresh con token revocado debe dar 401");

    // ── forgot/reset password ──────────────────────────────
    const forgotOk = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "cliente@fixture.test" }),
    });
    assert.equal(forgotOk.status, 200);
    const forgotNoUser = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "noexiste@fixture.test" }),
    });
    assert.equal(forgotNoUser.status, 200, "anti-enumeration: mismo 200 aunque no exista");

    // Token expirado, insertado directo (no se manda email real, Fase 6/8).
    const expiredRaw = randomUUID();
    const expiredHash = createHash("sha256").update(expiredRaw).digest("hex");
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 MINUTE))`,
      [randomUUID(), clienteId, expiredHash],
    );
    const resetExpired = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: expiredRaw, password: "NuevaPass123!" }),
    });
    assert.equal(resetExpired.status, 400, "token vencido debe rechazarse");

    const validRaw = randomUUID();
    const validHash = createHash("sha256").update(validRaw).digest("hex");
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
      [randomUUID(), clienteId, validHash],
    );
    const resetOk = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: validRaw, password: "NuevaPass123!" }),
    });
    assert.equal(resetOk.status, 204, "reset válido debe dar 204");

    const resetReuse = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: validRaw, password: "OtraPass123!" }),
    });
    assert.equal(resetReuse.status, 400, "reusar el mismo token ya usado debe rechazarse (single-use)");

    const loginNuevaPass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "cliente@fixture.test", password: "NuevaPass123!" }),
    });
    assert.equal(loginNuevaPass.status, 200, "login con la nueva contraseña debe funcionar");

    // ── users.service.js: crear/duplicado/reset-admin/borrar ──
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@fixture.test", password: PASSWORD }),
    });
    const { accessToken } = await adminLogin.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

    const createUser = await fetch(`${baseUrl}/api/users/portal`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, name: "Nuevo Portal", email: "nuevoportal@fixture.test", password: PASSWORD }),
    });
    assert.equal(createUser.status, 201);
    const created = await createUser.json();
    assert.ok(created.created_at, "debe traer created_at generado por la DB (vía SELECT posterior, sin RETURNING)");

    const createDup = await fetch(`${baseUrl}/api/users/portal`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ clientId, name: "Dup", email: "nuevoportal@fixture.test", password: PASSWORD }),
    });
    assert.equal(createDup.status, 409, "email duplicado debe dar 409 (normalización de ER_DUP_ENTRY -> 23505)");

    const adminResetPortal = await fetch(`${baseUrl}/api/users/${created.id}/reset-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ newPassword: "ResetPortal123!" }),
    });
    assert.equal(adminResetPortal.status, 200);

    const deletePortal = await fetch(`${baseUrl}/api/users/${created.id}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deletePortal.status, 200);
    const deletePortalAgain = await fetch(`${baseUrl}/api/users/${created.id}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deletePortalAgain.status, 404, "borrar de nuevo un usuario ya borrado debe dar 404");

    // ── updateProfile + notifications JSON round-trip ──────
    const updateProfile = await fetch(`${baseUrl}/api/auth/profile`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ name: "Super Admin Editado", notifications: { emailPayments: false, emailTickets: true, whatsapp: true, weeklyReport: false } }),
    });
    assert.equal(updateProfile.status, 200);
    const updated = await updateProfile.json();
    assert.deepEqual(updated.notifications, { emailPayments: false, emailTickets: true, whatsapp: true, weeklyReport: false });

    // ── changePassword ─────────────────────────────────────
    const changeWrong = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ oldPassword: "incorrecta", newPassword: "NuevaSA123!" }),
    });
    assert.equal(changeWrong.status, 400);
    const changeOk = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ oldPassword: PASSWORD, newPassword: "NuevaSA123!" }),
    });
    assert.equal(changeOk.status, 204);

    // ── CHECK de rol inválido ───────────────────────────────
    let checkErr;
    try {
      await pool.query(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`, [
        randomUUID(), "Rol Invalido", "rolinvalido@fixture.test", passwordHash, "rol_que_no_existe",
      ]);
    } catch (e) {
      checkErr = e;
    }
    assert.ok(checkErr, "un rol fuera del CHECK debe rechazarse");

    console.log("MARIADB_AUTH_FLOW_OK");
  } finally {
    await close();
  }
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
