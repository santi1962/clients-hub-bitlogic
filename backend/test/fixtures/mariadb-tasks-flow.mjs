// Fixture ejecutado en un proceso hijo separado por tasks-mariadb.test.js,
// mismo patrón que fixtures/mariadb-clients-flow.mjs.
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
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Fixture', 'admin@fixture.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );
  const staffId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Staff Fixture', 'staff@fixture.test', ?, 'soporte', 'active')`,
    [staffId, passwordHash],
  );
  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };

  const clientId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, email) VALUES (?, 'Cliente Fixture', 'cliente@fixture.test')`, [clientId]);
  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price) VALUES (?, 'Plan Fixture', 10, 999.00)`, [planId]);
  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
     VALUES (?, ?, ?, 'servicio-fixture.test', CURDATE(), CURDATE(), 10, 999.00)`,
    [serviceId, clientId, planId],
  );
  const ticketId = randomUUID();
  await pool.query(
    `INSERT INTO support_tickets (id, ticket_number, client_id, subject) VALUES (?, 'TK-2026-0001', ?, 'Ticket Fixture')`,
    [ticketId, clientId],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── crear tarea (con cliente, servicio y ticket asociados) ──
    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        title: "Revisar backup semanal", description: "Confirmar que corrió sin errores",
        priority: "high", assignedTo: staffId, clientId, serviceId, ticketId,
        dueDate: "2027-01-01",
      }),
    });
    assert.equal(createRes.status, 201);
    const task1 = await createRes.json();
    assert.match(task1.id, UUID_V4, "el id debe ser un UUID v4 generado por la app");
    assert.equal(task1.status, "pending");
    assert.equal(task1.priority, "high");
    assert.equal(task1.client_name, "Cliente Fixture", "el JOIN con clients debe traer el nombre real");
    assert.equal(task1.ticket_number, "TK-2026-0001", "el JOIN con support_tickets debe traer el ticket_number real");

    // ── crear tarea sin ninguna relación opcional (todas nullable) ──
    const createBareRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "Tarea suelta, sin cliente/servicio/ticket" }),
    });
    assert.equal(createBareRes.status, 201);
    const task2 = await createBareRes.json();
    assert.equal(task2.client_id, null);
    assert.equal(task2.priority, "normal", "prioridad default");

    // título faltante -> 400
    const createNoTitleRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST", headers: adminHeaders, body: JSON.stringify({}),
    });
    assert.equal(createNoTitleRes.status, 400);

    // ── FK: client_id inexistente -> 500 genérico (sin chequeo de negocio previo) ──
    const createBadClientRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ title: "No debería crearse", clientId: randomUUID() }),
    });
    assert.equal(createBadClientRes.status, 500);

    // ── obtener por id ──
    const getRes = await fetch(`${baseUrl}/api/tasks/${task1.id}`, { headers: adminHeaders });
    assert.equal(getRes.status, 200);
    const getMissingRes = await fetch(`${baseUrl}/api/tasks/${randomUUID()}`, { headers: adminHeaders });
    assert.equal(getMissingRes.status, 404);

    // ── listar, filtros, búsqueda case-insensitive, ordenamiento (due_date nulls last) ──
    const listRes = await fetch(`${baseUrl}/api/tasks`, { headers: adminHeaders });
    const listBody = await listRes.json();
    assert.ok(listBody.data.length >= 2);
    // task1 tiene due_date, task2 no (null) — con "nulls last" (t.due_date IS NULL)
    // task1 debe listarse antes que task2 en el orden ascendente por defecto.
    const idxTask1 = listBody.data.findIndex((t) => t.id === task1.id);
    const idxTask2 = listBody.data.findIndex((t) => t.id === task2.id);
    assert.ok(idxTask1 < idxTask2, "una tarea con due_date debe listarse antes que una sin due_date (NULLS LAST equivalente)");

    const filterPriorityRes = await fetch(`${baseUrl}/api/tasks?priority=high`, { headers: adminHeaders });
    const filterPriorityBody = await filterPriorityRes.json();
    assert.ok(filterPriorityBody.data.every((t) => t.priority === "high"));

    const filterClientRes = await fetch(`${baseUrl}/api/tasks?clientId=${clientId}`, { headers: adminHeaders });
    const filterClientBody = await filterClientRes.json();
    assert.ok(filterClientBody.data.every((t) => t.client_id === clientId));

    const searchRes = await fetch(`${baseUrl}/api/tasks?search=BACKUP`, { headers: adminHeaders });
    const searchBody = await searchRes.json();
    assert.ok(searchBody.data.some((t) => t.id === task1.id), "búsqueda LOWER()/LIKE debe encontrar 'backup semanal' buscando 'BACKUP'");

    // ── editar (título, prioridad, asignación) ──
    const { rows: beforeRows } = await pool.query(`SELECT updated_at FROM internal_tasks WHERE id = ?`, [task1.id]);
    await new Promise((r) => setTimeout(r, 1100));
    const updateRes = await fetch(`${baseUrl}/api/tasks/${task1.id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ priority: "urgent", assigned_to: adminId }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.priority, "urgent");
    assert.equal(updated.assigned_to, adminId);
    const { rows: afterRows } = await pool.query(`SELECT updated_at FROM internal_tasks WHERE id = ?`, [task1.id]);
    assert.ok(new Date(afterRows[0].updated_at) > new Date(beforeRows[0].updated_at), "updated_at debe avanzar tras un UPDATE real");

    // PATCH que repite el mismo valor -> no debe dar 404 espurio
    const updateSameRes = await fetch(`${baseUrl}/api/tasks/${task1.id}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ priority: "urgent" }),
    });
    assert.equal(updateSameRes.status, 200, "un PATCH que no modifica ningún valor no debe dar 404");

    const updateMissingRes = await fetch(`${baseUrl}/api/tasks/${randomUUID()}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ priority: "low" }),
    });
    assert.equal(updateMissingRes.status, 404);

    // ── completar ──
    const completeRes = await fetch(`${baseUrl}/api/tasks/${task1.id}/complete`, { method: "POST", headers: adminHeaders });
    assert.equal(completeRes.status, 200);
    const completed = await completeRes.json();
    assert.equal(completed.status, "completed");
    assert.ok(completed.completed_at);

    // ── reabrir ──
    const reopenRes = await fetch(`${baseUrl}/api/tasks/${task1.id}/reopen`, { method: "POST", headers: adminHeaders });
    assert.equal(reopenRes.status, 200);
    const reopened = await reopenRes.json();
    assert.equal(reopened.status, "pending");
    assert.equal(reopened.completed_at, null);

    const completeMissingRes = await fetch(`${baseUrl}/api/tasks/${randomUUID()}/complete`, { method: "POST", headers: adminHeaders });
    assert.equal(completeMissingRes.status, 404);

    // ── eliminar (hard delete) ──
    const deleteRes = await fetch(`${baseUrl}/api/tasks/${task2.id}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(deleteRes.status, 200);
    const deletedBody = await deleteRes.json();
    assert.equal(deletedBody.title, "Tarea suelta, sin cliente/servicio/ticket", "debe devolver la fila completa que existía");
    const getAfterDeleteRes = await fetch(`${baseUrl}/api/tasks/${task2.id}`, { headers: adminHeaders });
    assert.equal(getAfterDeleteRes.status, 404, "hard delete: la tarea ya no existe");

    const deleteMissingRes = await fetch(`${baseUrl}/api/tasks/${randomUUID()}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(deleteMissingRes.status, 404);

    // ── FK con clients (insert crudo) ──
    let fkErr;
    try {
      await pool.query(
        `INSERT INTO internal_tasks (id, title, client_id) VALUES (?, 'raw-fk-test', ?)`,
        [randomUUID(), randomUUID()],
      );
    } catch (e) { fkErr = e; }
    assert.ok(fkErr);
    assert.equal(fkErr.errno, 1452);

    // ── auditoría real: create/editar/completar/reabrir/eliminar, actor correcto ──
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, user_id FROM audit_logs WHERE entity_id = ?`,
      [task1.id],
    );
    const actions = auditRows.map((r) => r.action);
    assert.ok(actions.includes("crear"));
    assert.ok(actions.includes("editar"));
    assert.ok(actions.includes("completar"));
    assert.ok(actions.includes("reabrir"));
    assert.ok(auditRows.every((r) => r.entity_type === "tarea"));
    assert.ok(auditRows.every((r) => r.user_id === adminId), "el actor de la auditoría debe ser el usuario real autenticado");

    // ── fallo de auditoría no rompe la acción principal ──
    await pool.query(`DROP TABLE audit_logs`);
    const completeAfterAuditDrop = await fetch(`${baseUrl}/api/tasks/${task1.id}/reopen`, { method: "POST", headers: adminHeaders });
    assert.equal(completeAfterAuditDrop.status, 200, "la acción de negocio debe completarse igual aunque el INSERT de auditoría falle (best-effort)");

    console.log("MARIADB_TASKS_FLOW_OK");
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
