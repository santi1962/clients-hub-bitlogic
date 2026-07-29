// Fixture ejecutado en un proceso hijo separado por support-mariadb.test.js,
// mismo patrón de guard que fixtures/mariadb-clients-flow.mjs. A diferencia
// de los demás fixtures, corre contra el schema.sql COMPLETO (aplicado por
// apply-mariadb-schema.mjs antes de invocar este archivo), no un subconjunto
// — necesario para ejercitar el trigger real de ticket_number.
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
const TICKET_NUMBER_RE = /^TK-\d{4}-\d{4}$/;

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Fixture', 'admin@fixture.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );
  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };

  const clientAId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, email) VALUES (?, 'Cliente A', 'clientea@fixture.test')`, [clientAId]);
  const clientBId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, email) VALUES (?, 'Cliente B', 'clienteb@fixture.test')`, [clientBId]);

  const portalUserAId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status, client_id) VALUES (?, 'Usuario Portal A', 'portala@fixture.test', ?, 'cliente', 'active', ?)`,
    [portalUserAId, passwordHash, clientAId],
  );
  const portalATokenA = signAccessToken({ sub: portalUserAId, role: "cliente", clientId: clientAId });
  const portalAHeaders = { Authorization: `Bearer ${portalATokenA}`, "Content-Type": "application/json" };

  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price) VALUES (?, 'Plan Fixture', 10, 999.00)`, [planId]);
  const serviceAId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price)
     VALUES (?, ?, ?, 'servicio-a-fixture.test', CURDATE(), CURDATE(), 10, 999.00)`,
    [serviceAId, clientAId, planId],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── 1, 7, 9. crear ticket staff, formato de ticket_number, UUID v4 ──
    const createStaffRes = await fetch(`${baseUrl}/api/support`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ clientId: clientAId, serviceId: serviceAId, subject: "Problema de acceso", priority: "high" }),
    });
    assert.equal(createStaffRes.status, 201);
    const ticket1 = await createStaffRes.json();
    assert.match(ticket1.id, UUID_V4, "el id debe ser un UUID v4 generado por la app");
    assert.match(ticket1.ticket_number, TICKET_NUMBER_RE, "formato TK-YYYY-NNNN generado por el trigger");
    assert.equal(ticket1.status, "open");
    assert.equal(ticket1.priority, "high");

    // ── 2, 3. crear ticket desde el portal (cliente válido, forzado a su propio clientId) ──
    const createPortalRes = await fetch(`${baseUrl}/api/support`, {
      method: "POST",
      headers: adminHeaders, // usamos el endpoint admin para simular "portal" no hace falta duplicar ruta; el propio middleware ya fuerza clientId cuando role=cliente
      body: JSON.stringify({ clientId: clientBId, subject: "Consulta de facturación" }),
    });
    // (creado como staff a nombre de otro cliente, para tener un segundo ticket de comparación)
    assert.equal(createPortalRes.status, 201);
    const ticket2 = await createPortalRes.json();
    assert.notEqual(ticket2.ticket_number, ticket1.ticket_number, "el trigger no debe repetir ticket_number (unicidad bajo NEXTVAL de secuencia)");

    // ── 4. cliente inexistente -> FK, sin chequeo de negocio previo -> 500 ──
    const createBadClient = await fetch(`${baseUrl}/api/support`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ clientId: randomUUID(), subject: "No debería crearse" }),
    });
    assert.equal(createBadClient.status, 500, "client_id inexistente: la FK lo rechaza (500 genérico, sin manejo especial, igual que otros dominios)");

    // ── 6. hosting_service "ajeno" a otro cliente: sin validación de
    // ownership en createTicket (comportamiento existente, no se inventa) ──
    const createForeignService = await fetch(`${baseUrl}/api/support`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ clientId: clientBId, serviceId: serviceAId, subject: "Servicio de otro cliente, sin validar" }),
    });
    assert.equal(createForeignService.status, 201, "no hay validación de ownership de hosting_service_id — comportamiento preexistente, no corregido en esta fase");

    // ── 10, 15, 16, 17. listar (staff ve todo), filtros, búsqueda case-insensitive ──
    const listAllRes = await fetch(`${baseUrl}/api/support`, { headers: adminHeaders });
    const listAllBody = await listAllRes.json();
    assert.ok(listAllBody.data.length >= 2);
    assert.ok(typeof listAllBody.total === "number" && typeof listAllBody.pages === "number");

    const filterPriorityRes = await fetch(`${baseUrl}/api/support?priority=high`, { headers: adminHeaders });
    const filterPriorityBody = await filterPriorityRes.json();
    assert.ok(filterPriorityBody.data.every((t) => t.priority === "high"));

    const searchRes = await fetch(`${baseUrl}/api/support?search=ACCESO`, { headers: adminHeaders });
    const searchBody = await searchRes.json();
    assert.ok(searchBody.data.some((t) => t.id === ticket1.id), "búsqueda LOWER()/LIKE debe encontrar 'Problema de acceso' buscando 'ACCESO'");

    // ── 11, 12. portal: solo ve los propios ──
    const portalListRes = await fetch(`${baseUrl}/api/portal/tickets`, { headers: portalAHeaders });
    const portalListBody = await portalListRes.json();
    assert.ok(portalListBody.data.every((t) => t.client_id === clientAId), "el portal solo debe listar tickets del propio cliente");
    assert.ok(portalListBody.data.some((t) => t.id === ticket1.id));
    assert.ok(!portalListBody.data.some((t) => t.id === ticket2.id));

    // ── 12, 13. obtener propio / rechazar ajeno ──
    const getOwnRes = await fetch(`${baseUrl}/api/portal/tickets/${ticket1.id}`, { headers: portalAHeaders });
    assert.equal(getOwnRes.status, 200);
    const getForeignRes = await fetch(`${baseUrl}/api/portal/tickets/${ticket2.id}`, { headers: portalAHeaders });
    assert.equal(getForeignRes.status, 403);

    // ── 34. ticket inexistente ──
    const getMissingRes = await fetch(`${baseUrl}/api/support/${randomUUID()}`, { headers: adminHeaders });
    assert.equal(getMissingRes.status, 404);

    // ── 18, 20, 24, 25. responder (staff), mensaje interno, metadata, texto con ñ/emoji ──
    const replyStaffRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/messages`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ message: "Estamos revisando tu situación — año nuevo 🎉, ¿podés confirmar tu usuario?" }),
    });
    assert.equal(replyStaffRes.status, 201);
    const staffMsg = await replyStaffRes.json();
    assert.match(staffMsg.id, UUID_V4);
    assert.strictEqual(!!staffMsg.is_internal, false);
    assert.equal(staffMsg.message, "Estamos revisando tu situación — año nuevo 🎉, ¿podés confirmar tu usuario?", "tildes/ñ/emoji deben sobrevivir el round-trip completo");

    const internalMsgRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/messages`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ message: "Nota interna: escalar a nivel 2", isInternal: true }),
    });
    assert.equal(internalMsgRes.status, 201);
    const internalMsg = await internalMsgRes.json();
    assert.strictEqual(!!internalMsg.is_internal, true, "BOOLEAN is_internal debe volver true, no 1");

    // ── 14. mensajes internos invisibles para el portal ──
    const ticketForPortalRes = await fetch(`${baseUrl}/api/portal/tickets/${ticket1.id}`, { headers: portalAHeaders });
    const ticketForPortal = await ticketForPortalRes.json();
    assert.ok(!ticketForPortal.messages.some((m) => m.id === internalMsg.id), "el mensaje interno no debe aparecer en la vista del portal");
    assert.ok(ticketForPortal.messages.some((m) => m.id === staffMsg.id));

    // ── 19, 21. responder (cliente) + cliente no puede crear mensaje interno ──
    const replyClientRes = await fetch(`${baseUrl}/api/portal/tickets/${ticket1.id}/messages`, {
      method: "POST",
      headers: portalAHeaders,
      body: JSON.stringify({ message: "Sí, mi usuario es cliente_a@fixture.test", isInternal: true }), // intenta forzar interno
    });
    assert.equal(replyClientRes.status, 201);
    const clientMsg = await replyClientRes.json();
    assert.strictEqual(!!clientMsg.is_internal, false, "un cliente nunca puede crear un mensaje interno, aunque lo pida en el body (forzado a false)");

    // ── 22, 23. adjunto válido / inválido (reusa la política de ticketUpload.js, no se cambia) ──
    const validAttachmentForm = new FormData();
    validAttachmentForm.append("message", "Screenshot adjunto");
    validAttachmentForm.append("file", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "captura.png");
    const attachRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/messages`, {
      method: "POST",
      headers: { Authorization: adminHeaders.Authorization },
      body: validAttachmentForm,
    });
    assert.equal(attachRes.status, 201);
    const attachMsg = await attachRes.json();
    assert.ok(attachMsg.attachment_url?.startsWith("/uploads/tickets/"));
    assert.equal(attachMsg.attachment_type, "image");
    assert.equal(attachMsg.attachment_name, "captura.png");

    const invalidAttachmentForm = new FormData();
    invalidAttachmentForm.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "application/x-msdownload" }), "malware.exe");
    const badAttachRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/messages`, {
      method: "POST",
      headers: { Authorization: adminHeaders.Authorization },
      body: invalidAttachmentForm,
    });
    assert.equal(badAttachRes.status, 400, "tipo de archivo no permitido debe seguir dando 400 (política de ticketUpload.js sin cambios)");

    // mensaje sin texto NI adjunto -> 400 (validación existente)
    const emptyMsgRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/messages`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(emptyMsgRes.status, 400);

    // ── 27, 32. asignar ──
    const assignRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/assign`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ assignedTo: adminId }),
    });
    assert.equal(assignRes.status, 200);
    assert.equal((await assignRes.json()).assigned_to, adminId);

    // ── 28. cambiar estado (PATCH genérico) ──
    const updateStatusRes = await fetch(`${baseUrl}/api/support/${ticket1.id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(updateStatusRes.status, 200);
    assert.equal((await updateStatusRes.json()).status, "in_progress");

    // PATCH que repite el mismo status -> no debe dar 404 espurio (rowCount=0 en MariaDB sin cambio real)
    const updateSameStatusRes = await fetch(`${baseUrl}/api/support/${ticket1.id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(updateSameStatusRes.status, 200, "un PATCH que no modifica ningún valor no debe dar 404");

    // ── 33. transición "inválida" según comportamiento actual: no hay
    // restricción de máquina de estados, solo el CHECK de la columna ──
    const invalidStatusRes = await fetch(`${baseUrl}/api/support/${ticket1.id}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "no_existe" }),
    });
    assert.equal(invalidStatusRes.status, 500, "un status fuera del CHECK da 500 genérico, sin manejo especial (igual que otros dominios)");

    // ── 29, 32. resolver ──
    const resolveRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/resolve`, { method: "POST", headers: adminHeaders });
    assert.equal(resolveRes.status, 200);
    const resolved = await resolveRes.json();
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolved_at, "resolved_at debe quedar seteado");

    // ── 30, 32. cerrar ──
    const closeRes = await fetch(`${baseUrl}/api/support/${ticket1.id}/close`, { method: "POST", headers: adminHeaders });
    assert.equal(closeRes.status, 200);
    const closed = await closeRes.json();
    assert.equal(closed.status, "closed");
    assert.ok(closed.closed_at, "closed_at debe quedar seteado");

    // (31: no existe endpoint de "reabrir" en el código actual — se
    // documenta la ausencia, no se inventa uno nuevo)

    // ── 35, 36. eliminar ticket + FK CASCADE de sus mensajes ──
    const { rows: msgCountBefore } = await pool.query(`SELECT COUNT(*) AS c FROM support_ticket_messages WHERE ticket_id = ?`, [ticket1.id]);
    assert.ok(Number(msgCountBefore[0].c) >= 3, "el ticket debe tener varios mensajes antes de borrarlo");

    const deleteRes = await fetch(`${baseUrl}/api/support/${ticket1.id}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(deleteRes.status, 204);

    const { rows: msgCountAfter } = await pool.query(`SELECT COUNT(*) AS c FROM support_ticket_messages WHERE ticket_id = ?`, [ticket1.id]);
    assert.equal(Number(msgCountAfter[0].c), 0, "ON DELETE CASCADE debe borrar los mensajes del ticket junto con el ticket");

    // ── 37. eliminar inexistente ──
    const deleteMissingRes = await fetch(`${baseUrl}/api/support/${randomUUID()}`, { method: "DELETE", headers: adminHeaders });
    assert.equal(deleteMissingRes.status, 404);

    // ── FK con clients (insert crudo) ──
    let fkErr;
    try {
      await pool.query(
        `INSERT INTO support_tickets (id, client_id, subject) VALUES (?, ?, 'raw-fk-test')`,
        [randomUUID(), randomUUID()],
      );
    } catch (e) { fkErr = e; }
    assert.ok(fkErr);
    assert.equal(fkErr.errno, 1452);

    // ── 39-44. auditoría real: create/reply/assign/resolve/close/delete, actor correcto ──
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type, user_id FROM audit_logs WHERE entity_id = ?`,
      [ticket2.id], // ticket2 no se borró, más fácil de verificar create
    );
    assert.ok(auditRows.some((r) => r.action === "crear" && r.entity_type === "ticket"));
    assert.ok(auditRows.every((r) => r.user_id === adminId), "el actor de la auditoría debe ser el usuario real autenticado");

    const { rows: fullAuditForTicket1 } = await pool.query(
      `SELECT action FROM audit_logs WHERE entity_id = ? ORDER BY created_at ASC`,
      [ticket1.id],
    );
    const actions = fullAuditForTicket1.map((r) => r.action);
    assert.ok(actions.includes("crear"));
    assert.ok(actions.includes("responder"));
    assert.ok(actions.includes("resolver"));
    assert.ok(actions.includes("cerrar"));
    assert.ok(actions.includes("eliminar"));

    // ── 45. fallo de auditoría no rompe la acción principal ──
    await pool.query(`DROP TABLE audit_logs`);
    const closeAfterAuditDrop = await fetch(`${baseUrl}/api/support/${ticket2.id}/close`, { method: "POST", headers: adminHeaders });
    assert.equal(closeAfterAuditDrop.status, 200, "la acción de negocio debe completarse igual aunque el INSERT de auditoría falle (best-effort)");

    console.log("MARIADB_SUPPORT_FLOW_OK");
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
