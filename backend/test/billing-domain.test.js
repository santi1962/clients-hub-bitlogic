// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB del dominio Billing (Fase DB-3J): UUID v4 generado en la app,
// placeholders `?`, ILIKE -> LOWER()/LIKE, FILTER -> CASE WHEN, alias
// explícito de COUNT(*), UPDATE+SELECT vs. rowCount seguro (según si el
// WHERE excluye el estado destino), NEXTVAL/SETVAL con branching por driver,
// y revenueLast12Months calculado en Node en vez de generate_series(). La
// cobertura contra un motor MariaDB real está en billing-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as billingService from "../src/services/billing.service.js";
import { mockPoolQueries, mockPoolConnect } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeNoticeRow(overrides = {}) {
  return {
    id: "notice-1", client_id: "client-1", hosting_service_id: "service-1",
    notice_number: "AV-2026-0001", period_month: 7, period_year: 2026,
    issue_date: new Date(), due_date: new Date(), amount: "100.00", status: "pending",
    sent_at: null, paid_at: null, notes: null,
    client_name: "Juan", client_company: "ACME", client_email: "juan@acme.com", client_phone: null,
    service_domain: "acme.com", plan_name: "Plan A", created_at: new Date(),
    ...overrides,
  };
}

function fakePaymentRow(overrides = {}) {
  return {
    id: "payment-1", client_id: "client-1", hosting_service_id: "service-1", payment_notice_id: null,
    period_month: 7, period_year: 2026, amount: "100.00", method: "manual", status: "pending",
    paid_at: null, reference: null, internal_notes: null,
    client_name: "Juan", client_company: "ACME", service_domain: "acme.com", notice_number: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ── Notices ──────────────────────────────────────────────────

test("listNotices: búsqueda usa LOWER()/LIKE (no ILIKE) y el COUNT tiene alias explícito", async (t) => {
  let queries = [];
  const original = pool.query;
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("COUNT(*)")) return { rows: [{ count: "1" }] };
    return { rows: [fakeNoticeRow()] };
  };
  t.after(() => { pool.query = original; });

  const result = await billingService.listNotices({ search: "ACME" });

  assert.doesNotMatch(queries[0].sql, /ILIKE/);
  assert.match(queries[0].sql, /LOWER\(c\.company\) LIKE LOWER\(\?\)/);
  assert.match(queries[1].sql, /SELECT COUNT\(\*\) AS count/);
  assert.equal(result.meta.total, 1);
  assert.equal(result.data[0].clientCompany, "ACME");
});

test("createNotice: usa NEXTVAL para el número de aviso y genera un UUID v4 propio (no depende de DEFAULT (UUID()))", async (t) => {
  let insertParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call++;
    if (sql.includes("NEXTVAL")) return { rows: [{ n: 42 }] };
    if (sql.startsWith("INSERT INTO payment_notices")) {
      insertParams = params;
      return { rows: [], rowCount: 1 };
    }
    return { rows: [fakeNoticeRow({ id: params[0], notice_number: "AV-2026-0042" })] };
  };
  t.after(() => { pool.query = original; });

  const notice = await billingService.createNotice({
    clientId: "client-1", hostingServiceId: "service-1",
    periodMonth: 7, periodYear: 2026, dueDate: "2026-07-25", amount: 100,
  });

  assert.match(insertParams[0], UUID_V4, "el id insertado debe ser un UUID v4 generado por la app");
  assert.equal(notice.noticeNumber, "AV-2026-0042");
});

test("sendNotice: WHERE excluye 'sent' del origen -> decide 404 con rowCount, sin SELECT adicional", async (t) => {
  const original = pool.query;
  let updateSql;
  pool.query = async (sql, params) => {
    if (sql.startsWith("UPDATE payment_notices")) {
      updateSql = sql;
      return { rows: [], rowCount: 0 };
    }
    return { rows: [fakeNoticeRow()] };
  };
  t.after(() => { pool.query = original; });

  await assert.rejects(() => billingService.sendNotice("notice-1"), (err) => err.status === 404);
  assert.match(updateSql, /WHERE id = \? AND status IN \('draft','pending'\)/);
});

test("cancelNotice: WHERE excluye 'cancelled' del origen -> rowCount seguro, éxito con fila existente", async (t) => {
  const original = pool.query;
  pool.query = async (sql) => {
    if (sql.startsWith("UPDATE payment_notices")) return { rows: [], rowCount: 1 };
    return { rows: [fakeNoticeRow({ status: "cancelled" })] };
  };
  t.after(() => { pool.query = original; });

  const notice = await billingService.cancelNotice("notice-1");
  assert.equal(notice.status, "cancelled");
});

test("deleteNotice: DELETE sin RETURNING, rowCount decide 404 (sin ambigüedad de valor no cambiado)", async (t) => {
  mockPoolQueries(t, [{ rows: [], rowCount: 0 }]);
  await assert.rejects(() => billingService.deleteNotice("notice-1"), (err) => err.status === 404);
});

test("updateNotice: 404 se decide con un getNoticeById previo, no con el rowCount del UPDATE con COALESCE", async (t) => {
  const original = pool.query;
  let call = 0;
  pool.query = async (sql) => {
    call++;
    if (call === 1) return { rows: [] }; // getNoticeById previo: no existe
    throw new Error("no debería llegar al UPDATE si el aviso no existe");
  };
  t.after(() => { pool.query = original; });

  await assert.rejects(() => billingService.updateNotice("no-existe", { amount: 100 }), (err) => err.status === 404);
});

// ── Payments ─────────────────────────────────────────────────

test("listPayments: placeholders `?` en filtros dinámicos y alias de COUNT", async (t) => {
  let queries = [];
  const original = pool.query;
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("COUNT(*)")) return { rows: [{ count: "3" }] };
    return { rows: [fakePaymentRow()] };
  };
  t.after(() => { pool.query = original; });

  const result = await billingService.listPayments({ clientId: "client-1", status: "paid" });

  assert.match(queries[0].sql, /p\.client_id = \? AND p\.status = \?/);
  assert.deepEqual(queries[0].params.slice(0, 2), ["client-1", "paid"]);
  assert.equal(result.meta.total, 3);
});

test("createPayment: transacción BEGIN/INSERT/COMMIT con UUID v4 propio, marca el aviso relacionado si paidAt viene seteado", async (t) => {
  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },              // BEGIN
    { rows: [], rowCount: 1 },              // INSERT payments
    { rows: [], rowCount: 1 },              // UPDATE payment_notices
    { rows: [], rowCount: 1 },              // COMMIT
  ]);
  let getPaymentCall = 0;
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    getPaymentCall++;
    return { rows: [fakePaymentRow({ id: params[0] })] };
  };
  t.after(() => { pool.query = originalQuery; });

  const payment = await billingService.createPayment({
    clientId: "client-1", paymentNoticeId: "notice-1", periodMonth: 7, periodYear: 2026,
    amount: 100, paidAt: "2026-07-20",
  });

  assert.match(queries[0], /^BEGIN$/);
  assert.match(queries[1], /INSERT INTO payments/);
  assert.doesNotMatch(queries[1], /RETURNING/);
  assert.match(queries[2], /UPDATE payment_notices SET status = 'paid'/);
  assert.match(queries[3], /^COMMIT$/);
  assert.ok(payment);
});

test("markPaid: WHERE excluye 'paid' del origen -> rowCount seguro; lee payment_notice_id ANTES de la transacción (no depende de RETURNING *)", async (t) => {
  let preCheckCall = 0;
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    preCheckCall++;
    if (preCheckCall === 1) return { rows: [fakePaymentRow({ payment_notice_id: "notice-1", status: "pending" })] };
    return { rows: [fakePaymentRow({ payment_notice_id: "notice-1", status: "paid" })] };
  };
  t.after(() => { pool.query = originalQuery; });

  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [], rowCount: 1 },  // UPDATE payments (rowCount=1 -> existía y cambió)
    { rows: [], rowCount: 1 },  // UPDATE payment_notices
    { rows: [], rowCount: 1 },  // COMMIT
  ]);

  const payment = await billingService.markPaid("payment-1");

  assert.match(queries[1], /WHERE id = \? AND status != 'paid'/);
  assert.match(queries[2], /UPDATE payment_notices SET status = 'paid'/);
  assert.equal(payment.status, "paid");
});

test("markPaid: si el UPDATE no matchea (ya estaba pagado) -> 404, hace ROLLBACK", async (t) => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [fakePaymentRow({ status: "paid" })] });
  t.after(() => { pool.query = originalQuery; });

  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [], rowCount: 0 },  // UPDATE no matchea
    { rows: [], rowCount: 1 },  // ROLLBACK
  ]);

  await assert.rejects(() => billingService.markPaid("payment-1"), (err) => err.status === 404);
  assert.match(queries[2], /^ROLLBACK$/);
});

test("deletePayment: lee la fila antes de borrar (reemplaza DELETE...RETURNING *) y revierte el aviso si estaba pagado", async (t) => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [fakePaymentRow({ payment_notice_id: "notice-1", status: "paid" })] });
  t.after(() => { pool.query = originalQuery; });

  const { queries } = mockPoolConnect(t, [
    { rows: [], rowCount: 1 },  // BEGIN
    { rows: [], rowCount: 1 },  // DELETE
    { rows: [], rowCount: 1 },  // UPDATE payment_notices revert
    { rows: [], rowCount: 1 },  // COMMIT
  ]);

  await billingService.deletePayment("payment-1");

  assert.match(queries[1], /^DELETE FROM payments WHERE id = \?$/);
  assert.match(queries[2], /UPDATE payment_notices SET status = 'pending', paid_at = NULL/);
});

// ── Summaries ─────────────────────────────────────────────────

test("getClientSummary: usa CASE WHEN en vez de FILTER (WHERE ...) y placeholders `?`", async (t) => {
  let queries = [];
  const original = pool.query;
  pool.query = async (sql, params) => {
    queries.push(sql);
    if (sql.includes("total_paid")) return { rows: [{ total_paid: "500", total_pending: "100", total_overdue: "50", last_payment_date: null }] };
    if (sql.includes("notices_pending")) return { rows: [{ notices_pending: "2", notices_overdue: "1" }] };
    return { rows: [{ services_count: "3", next_due_date: null }] };
  };
  t.after(() => { pool.query = original; });

  const summary = await billingService.getClientSummary("client-1");

  assert.doesNotMatch(queries.join(" "), /FILTER \(WHERE/);
  assert.match(queries[0], /CASE WHEN status = 'paid'/);
  assert.equal(summary.totalPaid, 500);
  assert.equal(summary.debt, 150);
});

test("getGlobalSummary: revenueLast12Months rellena con 0 los meses sin cobros (reemplaza generate_series), usa EXTRACT bindeado en vez de date_trunc", async (t) => {
  const original = pool.query;
  pool.query = async (sql, params) => {
    if (sql.includes("hp.name")) return { rows: [{ name: "Plan A", value: "5" }] };
    if (sql.includes("monthly_price")) return { rows: [{ monthly: "1000" }] };
    if (sql.includes("collected_this_month")) {
      assert.equal(params.length, 2);
      assert.ok(params[0] instanceof Date);
      return { rows: [{ collected_this_month: "500", pending_total: "200", overdue_total: "100" }] };
    }
    if (sql.includes("pending_count")) return { rows: [{ pending_count: "3", overdue_count: "1" }] };
    if (sql.includes("EXTRACT(YEAR")) {
      assert.ok(params[0] instanceof Date, "cutoff de 12 meses bindeado como parámetro, no generate_series");
      const now = new Date();
      return { rows: [{ year: String(now.getFullYear()), month: String(now.getMonth() + 1), total: "500" }] };
    }
    return { rows: [] }; // overduePayments
  };
  t.after(() => { pool.query = original; });

  const summary = await billingService.getGlobalSummary();

  assert.equal(summary.revenueLast12Months.length, 12);
  const currentMonthEntry = summary.revenueLast12Months[11];
  assert.equal(currentMonthEntry.total, 500);
  assert.ok(summary.revenueLast12Months.slice(0, 11).every((m) => m.total === 0), "meses sin cobros deben quedar en 0, no ausentes");
  assert.equal(summary.planDistribution[0].value, 5);
  assert.equal(summary.monthly, 1000);
  assert.equal(summary.annualProjection, 12000);
});
