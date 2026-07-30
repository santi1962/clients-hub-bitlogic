// Tests unitarios (mockeados, lado Postgres) para los hallazgos de la Fase
// DB-3K: las 5 queries de email.service.js que quedaban sin convertir
// (sendTicketReplyEmail, sendDomainReminderEmail, sendServiceSuspendedEmail,
// sendServiceReactivatedEmail, listLogs — esta última encontrada recién en
// esta fase, no estaba en el inventario de DB-3J), el UUID v4 explícito y
// los placeholders `?` de payment_reminder_logs (payment-reminders.job.js),
// y analyticsData (dashboard.controller.js, nunca convertido en DB-3I). La
// cobertura de extremo a extremo contra un motor MariaDB real está en
// full-app-mariadb-smoke.test.js (arranque completo de la aplicación).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import { emailService } from "../src/services/email.service.js";
import { paymentRemindersDaily } from "../src/jobs/payment-reminders.job.js";
import { automationSettingsService } from "../src/services/automation-settings.service.js";
import { analyticsData } from "../src/controllers/dashboard.controller.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// ── email.service.js: las 5 queries sin convertir ──────────────

test("sendTicketReplyEmail: usa placeholders `?` para el ticket y el mensaje (antes $1)", async (t) => {
  const original = pool.query;
  const originalSendEmail = emailService.sendEmail;
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push(sql);
    if (sql.includes("support_tickets")) {
      return { rows: [{ id: "t-1", ticket_number: "TK-2026-0001", subject: "Ayuda", client_id: "c-1", email: "cliente@test.com", name: "Juan", company: "ACME" }] };
    }
    if (sql.includes("support_ticket_messages")) {
      return { rows: [{ message: "Hola", created_at: new Date() }] };
    }
    return { rows: [] };
  };
  emailService.sendEmail = async () => ({ success: true, messageId: "mock-1" });
  t.after(() => { pool.query = original; emailService.sendEmail = originalSendEmail; });

  const result = await emailService.sendTicketReplyEmail("t-1", "m-1");

  assert.equal(result.success, true);
  assert.ok(queries.every((q) => !/\$\d/.test(q)), "ninguna de las 2 queries debe usar placeholders $N");
});

test("sendDomainReminderEmail: usa placeholders `?` (antes $1)", async (t) => {
  const original = pool.query;
  const originalSendEmail = emailService.sendEmail;
  let capturedSql;
  pool.query = async (sql, params) => {
    if (sql.includes("email_templates")) return { rows: [] }; // fallback a DEFAULT_TEMPLATES
    if (sql.includes("FROM domains d")) {
      capturedSql = sql;
      return { rows: [{ id: "d-1", domain: "acme.com", expiration_date: new Date(), client_id: "c-1", name: "Juan", email: "cliente@test.com", company: "ACME" }] };
    }
    return { rows: [], rowCount: 1 }; // logEmail()
  };
  emailService.sendEmail = async () => ({ success: true, messageId: "mock-1" });
  t.after(() => { pool.query = original; emailService.sendEmail = originalSendEmail; });

  const result = await emailService.sendDomainReminderEmail("d-1");

  assert.equal(result.success, true);
  assert.doesNotMatch(capturedSql, /\$\d/);
  assert.match(capturedSql, /WHERE d\.id = \?/);
});

test("sendServiceSuspendedEmail / sendServiceReactivatedEmail: usan placeholders `?` (antes $1)", async (t) => {
  const original = pool.query;
  const originalSendEmail = emailService.sendEmail;
  const queries = [];
  pool.query = async (sql) => {
    if (sql.includes("email_templates")) return { rows: [] }; // fallback a DEFAULT_TEMPLATES
    if (sql.includes("hosting_services")) queries.push(sql);
    if (sql.includes("hosting_services")) {
      return { rows: [{ id: "s-1", domain: "acme.com", client_id: "c-1", name: "Juan", email: "cliente@test.com", company: "ACME" }] };
    }
    return { rows: [], rowCount: 1 }; // logEmail()
  };
  emailService.sendEmail = async () => ({ success: true, messageId: "mock-1" });
  t.after(() => { pool.query = original; emailService.sendEmail = originalSendEmail; });

  await emailService.sendServiceSuspendedEmail("s-1");
  await emailService.sendServiceReactivatedEmail("s-1");

  assert.equal(queries.length, 2);
  assert.ok(queries.every((q) => /WHERE s\.id = \?/.test(q)));
});

test("listLogs: ILIKE -> LOWER()/LIKE, placeholders `?`, y alias explícito de COUNT(*)", async (t) => {
  const original = pool.query;
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("COUNT(*)")) return { rows: [{ count: "2" }] };
    return { rows: [{ id: "log-1", type: "payment_notice", recipient: "cliente@test.com", subject: "x", status: "sent" }] };
  };
  t.after(() => { pool.query = original; });

  const result = await emailService.listLogs({ recipient: "cliente", status: "sent" });

  assert.doesNotMatch(queries[0].sql, /ILIKE/);
  assert.match(queries[0].sql, /LOWER\(recipient\) LIKE LOWER\(\?\)/);
  assert.match(queries[1].sql, /SELECT COUNT\(\*\) AS count/);
  assert.equal(result.meta.total, 2);
});

// ── payment_reminder_logs (payment-reminders.job.js) ───────────

test("paymentRemindersDaily: genera un UUID v4 propio en el INSERT de payment_reminder_logs (ya no depende de DEFAULT (UUID()))", async (t) => {
  const originalIsReminderEnabled = automationSettingsService.isReminderEnabled;
  automationSettingsService.isReminderEnabled = async (type) => type === "due_today";
  t.after(() => { automationSettingsService.isReminderEnabled = originalIsReminderEnabled; });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const original = pool.query;
  let insertParams;
  pool.query = async (sql, params) => {
    if (sql.includes("FROM payment_notices pn")) {
      return {
        rows: [
          { id: "notice-1", notice_number: "AV-1", client_id: "c-1", amount: "100", due_date: today, status: "pending", contact_email: "cliente@test.com", contact_phone: null, company: "ACME" },
        ],
      };
    }
    if (sql.includes("SELECT id FROM payment_reminder_logs")) {
      return { rows: [] }; // sin duplicado
    }
    if (sql.trim().startsWith("INSERT INTO payment_reminder_logs")) {
      insertParams = params;
      return { rows: [], rowCount: 1 };
    }
    return { rows: [] };
  };
  t.after(() => { pool.query = original; });

  // sendPaymentNoticeEmail intentaría mandar un email real (SMTP no
  // configurado en test) — se deja que falle y se capture como parte del
  // flujo normal del job (no bloquea el conteo de "sent" en el resumen,
  // solo valida acá que el INSERT de log recibe un id explícito).
  await paymentRemindersDaily().catch(() => {});

  assert.ok(insertParams, "debería haber intentado loguear el recordatorio");
  assert.match(insertParams[0], UUID_V4, "el id del log debe ser un UUID v4 generado por la app");
  assert.equal(insertParams[1], "notice-1");
});

// ── dashboard.controller.js: analyticsData (nunca convertido en DB-3I) ──

test("analyticsData: sin generate_series/DATE_TRUNC/TO_CHAR — 6 meses calculados en Node, EXTRACT bindeado", async (t) => {
  const original = pool.query;
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("EXTRACT(YEAR FROM paid_at)")) {
      const now = new Date();
      return { rows: [{ year: String(now.getFullYear()), month: String(now.getMonth() + 1), revenue: "1500.00" }] };
    }
    if (sql.includes("FROM clients WHERE created_at")) {
      return { rows: [{ count: "4" }] };
    }
    return { rows: [] };
  };
  t.after(() => { pool.query = original; });

  const req = {};
  const res = fakeRes();
  await analyticsData(req, res, (err) => assert.fail(err));

  assert.ok(queries.every((q) => !/generate_series|DATE_TRUNC|TO_CHAR/i.test(q.sql)));
  assert.equal(res.body.revenue_trend.length, 6);
  assert.equal(res.body.client_trend.length, 6);
  assert.equal(res.body.revenue_trend[5].revenue, 1500);
  assert.equal(res.body.client_trend[0].clients, 4);
});
