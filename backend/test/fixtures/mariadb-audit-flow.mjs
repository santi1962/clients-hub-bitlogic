// Fixture ejecutado en un proceso hijo separado por audit-mariadb.test.js,
// mismo patrón que fixtures/mariadb-clients-flow.mjs (ver ese archivo para el
// detalle del guard MARIADB_FIXTURE_RUN).
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import pool from "../../src/db/pool.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { startEphemeralServer } from "../helpers/server.js";

const PASSWORD = "Password123!";

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Fixture', 'admin@fixture.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );
  const token = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── 18. acciones reales de dominios ya convertidos generan audit_logs ──
    // (esto es, literalmente, la confirmación de que el punto ciego de
    // auditoría contra MariaDB desapareció: antes de esta fase, estas mismas
    // llamadas HTTP daban el status code correcto pero el INSERT INTO
    // audit_logs fallaba por sintaxis $N y se tragaba en silencio)
    const createClientRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Cliente Auditado", email: "auditado@fixture.test" }),
    });
    assert.equal(createClientRes.status, 201);
    const client = await createClientRes.json();

    const createPlanRes = await fetch(`${baseUrl}/api/hosting/plans`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Plan Auditado", storageGb: 10, monthlyPrice: 15 }),
    });
    assert.equal(createPlanRes.status, 201);
    const plan = await createPlanRes.json();

    const createServiceRes = await fetch(`${baseUrl}/api/hosting/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        clientId: client.id, planId: plan.id, domain: "auditado.test",
        monthlyPrice: 15, setupDate: "2026-01-01", nextDueDate: "2026-02-01",
      }),
    });
    assert.equal(createServiceRes.status, 201);
    const service = await createServiceRes.json();

    await fetch(`${baseUrl}/api/clients/${client.id}`, {
      method: "PATCH", headers: authHeaders, body: JSON.stringify({ company: "ACME" }),
    });
    await fetch(`${baseUrl}/api/clients/${client.id}`, { method: "DELETE", headers: authHeaders });

    // created_at es DATETIME (resolución de 1 segundo) — con varias
    // escrituras en la misma ráfaga, el orden entre filas con timestamp
    // idéntico no está garantizado. Se verifica por conteo/pertenencia, no
    // por posición.
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, entity_id, user_id, user_name FROM audit_logs WHERE entity_id IN (?, ?, ?) ORDER BY created_at ASC`,
      [client.id, plan.id, service.id],
    );
    assert.equal(auditRows.length, 5, "create+update+delete de cliente (3) + create de plan (1) + create de servicio (1) deben quedar auditados");
    assert.equal(auditRows.filter((r) => r.entity_type === "cliente").length, 3);
    assert.equal(auditRows.filter((r) => r.entity_type === "plan_hosting").length, 1);
    assert.equal(auditRows.filter((r) => r.entity_type === "servicio").length, 1);
    assert.ok(auditRows.every((r) => r.user_id === adminId), "user_id debe ser el usuario real autenticado, no null, en las 5 filas");
    assert.ok(auditRows.every((r) => r.user_name === "Admin Fixture"));

    // ── 9. JSON con tildes, ñ y emoji (round-trip completo vía el endpoint real) ──
    const specialCharsRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Client Ñandú 🎉", email: "nandu@fixture.test", notes: "reunión próxima — año nuevo 🎊" }),
    });
    const specialClient = await specialCharsRes.json();
    const { rows: specialAuditRows } = await pool.query(
      `SELECT id FROM audit_logs WHERE entity_id = ? AND action = 'create'`,
      [specialClient.id],
    );
    const auditDetailRes = await fetch(`${baseUrl}/api/audit/${specialAuditRows[0].id}`, { headers: authHeaders });
    assert.equal(auditDetailRes.status, 200);
    const auditDetail = await auditDetailRes.json();
    assert.equal(auditDetail.newValues.name, "Client Ñandú 🎉", "tildes/ñ/emoji deben sobrevivir el round-trip completo (INSERT JSON.stringify -> columna JSON -> SELECT -> parseo defensivo)");
    assert.equal(auditDetail.oldValues, null, "un alta no tiene oldValues");

    // ── 10, 11, 12. listado paginado + filtro por action + filtro por entity_type ──
    const listRes = await fetch(`${baseUrl}/api/audit?page=1&limit=2`, { headers: authHeaders });
    const listBody = await listRes.json();
    assert.equal(listBody.data.length, 2, "paginación: limit=2 debe devolver exactamente 2 filas");
    assert.ok(listBody.meta.total >= 6, "total debe contar todas las filas, no solo la página actual");

    // "desactivar" es el action real que usa clients.controller.js para su
    // soft-delete (DELETE /api/clients/:id) — no "eliminar" (ese nombre lo
    // usa plans.controller.js para su hard delete).
    const filterActionRes = await fetch(`${baseUrl}/api/audit?action=desactivar`, { headers: authHeaders });
    const filterActionBody = await filterActionRes.json();
    assert.ok(filterActionBody.data.every((r) => r.action === "desactivar"));
    assert.ok(filterActionBody.data.some((r) => r.entity_id === client.id));

    const filterEntityRes = await fetch(`${baseUrl}/api/audit?entityType=plan_hosting`, { headers: authHeaders });
    const filterEntityBody = await filterEntityRes.json();
    assert.ok(filterEntityBody.data.every((r) => r.entity_type === "plan_hosting"));

    // ── 13. filtro por user_id ──
    const filterUserRes = await fetch(`${baseUrl}/api/audit?userId=${adminId}`, { headers: authHeaders });
    const filterUserBody = await filterUserRes.json();
    assert.ok(filterUserBody.data.length >= 6);
    assert.ok(filterUserBody.data.every((r) => r.user_id === adminId));

    // ── 14. fecha UTC ──
    const beforeInsert = Date.now();
    const { rows: dateRows } = await pool.query(`SELECT created_at FROM audit_logs WHERE entity_id = ? LIMIT 1`, [client.id]);
    const createdAtMs = new Date(dateRows[0].created_at).getTime();
    assert.ok(Math.abs(createdAtMs - beforeInsert) < 60_000, "created_at debe estar en UTC y no desviarse por zona horaria (diferencia razonable respecto al reloj del test)");

    // ── 15. usuario eliminado y comportamiento de FK ──
    await pool.query(`DELETE FROM users WHERE id = ?`, [adminId]);
    const { rows: afterUserDelete } = await pool.query(`SELECT user_id, user_name FROM audit_logs WHERE entity_id = ? AND action = 'create'`, [client.id]);
    assert.equal(afterUserDelete[0].user_id, null, "ON DELETE SET NULL: borrar el usuario no borra el audit log, solo pone user_id en null");
    assert.equal(afterUserDelete[0].user_name, "Admin Fixture", "user_name (copiado al momento de la acción) se conserva aunque el usuario ya no exista");

    console.log("MARIADB_AUDIT_FLOW_OK");
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
