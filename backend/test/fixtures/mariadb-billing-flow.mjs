// Fixture ejecutado en un proceso hijo separado por billing-mariadb.test.js
// (Fase DB-3J: Billing). Corre contra el schema.sql COMPLETO (aplicado por
// apply-mariadb-schema.mjs antes de invocar este archivo) — mismo motivo que
// support/settings/infra-services: el schema tiene triggers con DELIMITER
// que mysql2 no puede ejecutar, y aunque billing en sí no depende de
// ninguno, reusar el runner oficial es más simple que armar un subconjunto
// manual de 5 tablas con FKs cruzadas (clients, hosting_plans,
// hosting_services, payment_notices, payments).
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import pool from "../../src/db/pool.js";
import * as billingService from "../../src/services/billing.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { startEphemeralServer } from "../helpers/server.js";

const PASSWORD = "Password123!";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTICE_NUMBER_RE = /^AV-\d{4}-\d{4}$/;

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Fixture', 'admin@fixture.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );
  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };

  const clientId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, company, email, status) VALUES (?, 'Cliente Fixture', 'ACME', 'cliente@fixture.test', 'active')`, [clientId]);
  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price, status) VALUES (?, 'Plan Fixture', 10, 1000.00, 'active')`, [planId]);
  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price, status)
     VALUES (?, ?, ?, 'servicio-fixture.test', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 10, 1000.00, 'active')`,
    [serviceId, clientId, planId],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── 1. Crear aviso: UUID v4 + NEXTVAL real de MariaDB para notice_number ──
    const createNoticeRes = await fetch(`${baseUrl}/api/billing/notices`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        clientId, hostingServiceId: serviceId, periodMonth: 7, periodYear: 2026,
        dueDate: "2026-07-25", amount: 100.5,
      }),
    });
    assert.equal(createNoticeRes.status, 201);
    const notice1 = await createNoticeRes.json();
    assert.match(notice1.id, UUID_V4, "el id del aviso debe ser un UUID v4 generado por la app");
    assert.match(notice1.noticeNumber, NOTICE_NUMBER_RE, "formato AV-YYYY-NNNN generado con NEXTVAL real de MariaDB");

    // Segundo aviso -> el NEXTVAL no debe repetir número
    const createNotice2Res = await fetch(`${baseUrl}/api/billing/notices`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        clientId, hostingServiceId: serviceId, periodMonth: 8, periodYear: 2026,
        dueDate: "2026-08-25",
      }),
    });
    assert.equal(createNotice2Res.status, 201);
    const notice2 = await createNotice2Res.json();
    assert.notEqual(notice2.noticeNumber, notice1.noticeNumber, "NEXTVAL no debe repetir número entre dos avisos seguidos");
    assert.equal(notice2.amount, 1000, "sin amount explícito, toma monthly_price del servicio");

    // ── 2. Listar con búsqueda (LOWER()/LIKE en vez de ILIKE) ──
    const searchRes = await fetch(`${baseUrl}/api/billing/notices?search=ACME`, { headers: adminHeaders });
    const searchBody = await searchRes.json();
    assert.ok(searchBody.data.some((n) => n.id === notice1.id), "búsqueda case-insensitive debe encontrar el aviso por company 'ACME'");
    assert.equal(typeof searchBody.meta.total, "number", "COUNT(*) con alias explícito debe llegar como número, no undefined");

    // ── 3. Obtener por id ──
    const getRes = await fetch(`${baseUrl}/api/billing/notices/${notice1.id}`, { headers: adminHeaders });
    assert.equal(getRes.status, 200);

    // ── 4. Editar (UPDATE con COALESCE, 404 decidido por SELECT previo) ──
    const updateRes = await fetch(`${baseUrl}/api/billing/notices/${notice1.id}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ amount: 150.75 }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal((await updateRes.json()).amount, 150.75);

    const updateMissingRes = await fetch(`${baseUrl}/api/billing/notices/${randomUUID()}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ amount: 10 }),
    });
    assert.equal(updateMissingRes.status, 404, "PATCH sobre un aviso inexistente debe dar 404 (getNoticeById previo)");

    // ── 5. sendNotice a nivel de servicio (bypass del email real, sin SMTP
    // configurado en este entorno de test — ver docs/TESTING.md, no es meta
    // de esta migración probar envío real de SMTP) — valida el UPDATE con
    // WHERE que excluye el estado destino, rowCount seguro contra MariaDB real ──
    const sentNotice = await billingService.sendNotice(notice2.id);
    assert.equal(sentNotice.status, "sent");
    await assert.rejects(
      () => billingService.sendNotice(notice2.id),
      (err) => err.status === 404,
      "un aviso ya enviado no puede reenviarse (WHERE status IN ('draft','pending') ya no matchea)",
    );

    // ── 6. Cancelar aviso (mismo patrón rowCount-seguro) ──
    const cancelRes = await fetch(`${baseUrl}/api/billing/notices/${notice1.id}/cancel`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(cancelRes.status, 200);
    assert.equal((await cancelRes.json()).status, "cancelled");

    const cancelAgainRes = await fetch(`${baseUrl}/api/billing/notices/${notice1.id}/cancel`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(cancelAgainRes.status, 404, "un aviso ya cancelado no puede volver a cancelarse");

    // ── 7. Eliminar aviso cancelado (DELETE, rowCount seguro) ──
    const deleteRes = await fetch(`${baseUrl}/api/billing/notices/${notice1.id}`, {
      method: "DELETE", headers: adminHeaders,
    });
    assert.equal(deleteRes.status, 204);

    // ── 8. Crear pago con paidAt -> transacción marca el aviso relacionado
    // como pagado (BEGIN/INSERT/UPDATE/COMMIT real contra MariaDB) ──
    const createPaymentRes = await fetch(`${baseUrl}/api/billing/payments`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        clientId, hostingServiceId: serviceId, paymentNoticeId: notice2.id,
        periodMonth: 8, periodYear: 2026, amount: 1000, method: "Transferencia",
        paidAt: "2026-08-20",
      }),
    });
    assert.equal(createPaymentRes.status, 201);
    const payment1 = await createPaymentRes.json();
    assert.match(payment1.id, UUID_V4);
    assert.equal(payment1.status, "paid");

    const noticeAfterPaymentRes = await fetch(`${baseUrl}/api/billing/notices/${notice2.id}`, { headers: adminHeaders });
    assert.equal((await noticeAfterPaymentRes.json()).status, "paid", "la transacción de createPayment debe marcar el aviso relacionado como pagado");

    // ── 9. Crear un segundo pago sin paidAt (pending) y marcarlo pagado con
    // mark-paid (WHERE excluye 'paid' del origen, rowCount seguro) ──
    const createPayment2Res = await fetch(`${baseUrl}/api/billing/payments`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ clientId, periodMonth: 9, periodYear: 2026, amount: 50, method: "Efectivo" }),
    });
    assert.equal(createPayment2Res.status, 201);
    const payment2 = await createPayment2Res.json();
    assert.equal(payment2.status, "pending");

    const markPaidRes = await fetch(`${baseUrl}/api/billing/payments/${payment2.id}/mark-paid`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(markPaidRes.status, 200);
    assert.equal((await markPaidRes.json()).status, "paid");

    const markPaidAgainRes = await fetch(`${baseUrl}/api/billing/payments/${payment2.id}/mark-paid`, {
      method: "POST", headers: adminHeaders,
    });
    assert.equal(markPaidAgainRes.status, 404, "un pago ya pagado no puede volver a marcarse pagado");

    // ── 10. Listar/filtrar pagos, editar, eliminar (revierte el aviso si
    // había quedado marcado 'paid' por ese pago) ──
    const listPaymentsRes = await fetch(`${baseUrl}/api/billing/payments?status=pagado`, { headers: adminHeaders });
    const listPaymentsBody = await listPaymentsRes.json();
    assert.ok(listPaymentsBody.data.every((p) => p.status === "paid"));

    const updatePaymentRes = await fetch(`${baseUrl}/api/billing/payments/${payment1.id}`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ internalNotes: "Verificado" }),
    });
    assert.equal(updatePaymentRes.status, 200);
    assert.equal((await updatePaymentRes.json()).internalNotes, "Verificado");

    const deletePaymentRes = await fetch(`${baseUrl}/api/billing/payments/${payment1.id}`, {
      method: "DELETE", headers: adminHeaders,
    });
    assert.equal(deletePaymentRes.status, 204);

    const noticeAfterDeleteRes = await fetch(`${baseUrl}/api/billing/notices/${notice2.id}`, { headers: adminHeaders });
    assert.equal((await noticeAfterDeleteRes.json()).status, "pending", "borrar el pago que había marcado el aviso como pagado debe revertirlo a pending");

    // ── 11. Resúmenes: cliente y global (CASE WHEN en vez de FILTER,
    // EXTRACT en vez de date_trunc, meses sin generate_series) ──
    const clientSummaryRes = await fetch(`${baseUrl}/api/billing/clients/${clientId}/summary`, { headers: adminHeaders });
    assert.equal(clientSummaryRes.status, 200);
    const clientSummary = await clientSummaryRes.json();
    // payment1 (1000, paid) fue borrado en el paso 10; payment2 (50) quedó
    // "paid" tras mark-paid -> no debe seguir contando como pending.
    assert.equal(clientSummary.totalPaid, 50, "CASE WHEN status='paid' debe sumar el pago de Efectivo ya marcado pagado");
    assert.equal(clientSummary.totalPending, 0, "el pago de Efectivo marcado pagado no debe seguir contando como pending");

    const globalSummaryRes = await fetch(`${baseUrl}/api/billing/summary`, { headers: adminHeaders });
    assert.equal(globalSummaryRes.status, 200);
    const globalSummary = await globalSummaryRes.json();
    assert.equal(globalSummary.revenueLast12Months.length, 12);
    assert.equal(globalSummary.monthly, 1000);
    assert.ok(globalSummary.revenueLast12Months.some((m) => m.total > 0), "algún mes de los últimos 12 debe reflejar el pago cobrado (Efectivo, marcado pagado)");

    // ── 12. FK real: crear un aviso/pago con client_id inexistente falla ──
    let fkErr;
    try {
      await pool.query(
        `INSERT INTO payment_notices (id, client_id, hosting_service_id, notice_number, period_month, period_year, due_date, amount)
         VALUES (?, ?, ?, 'AV-RAW-TEST', 1, 2026, CURDATE(), 10)`,
        [randomUUID(), randomUUID(), serviceId],
      );
    } catch (e) { fkErr = e; }
    assert.ok(fkErr);
    assert.equal(fkErr.errno, 1452, "FK de client_id debe rechazar un cliente inexistente (ER_NO_REFERENCED_ROW)");

    // ── 13. UUID real: id sin DEFAULT (UUID()) -> un INSERT sin id explícito debe fallar ──
    let noDefaultErr;
    try {
      await pool.query(
        `INSERT INTO payments (client_id, period_month, period_year, amount) VALUES (?, 1, 2026, 10)`,
        [clientId],
      );
    } catch (e) { noDefaultErr = e; }
    assert.ok(noDefaultErr, "payments.id ya no debe tener DEFAULT (UUID()) — un INSERT sin id explícito debe fallar");

    // ── 14. Auditoría real de las acciones de billing ──
    const { rows: auditRows } = await pool.query(
      `SELECT action, entity_type FROM audit_logs WHERE entity_id = ? ORDER BY created_at ASC`,
      [notice1.id],
    );
    assert.ok(auditRows.some((r) => r.action === "crear" && r.entity_type === "aviso"));
    assert.ok(auditRows.some((r) => r.action === "cancelar"));
    assert.ok(auditRows.some((r) => r.action === "eliminar"));

    console.log("MARIADB_BILLING_FLOW_OK");
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
