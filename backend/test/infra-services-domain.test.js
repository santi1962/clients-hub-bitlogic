// Tests unitarios (mockeados, lado Postgres) específicos de la conversión a
// MariaDB de la Fase DB-3I: Email Templates + Automation Settings +
// Scheduler + Dashboard. Cubre: placeholders `?`, UUID generado en la app
// (scheduler_logs), parseo defensivo de JSON (automation_settings.value),
// reemplazo de DATE_TRUNC/INTERVAL/NOW()::date por parámetros calculados en
// Node, y COUNT/SUM sin cast ::int/::float (parseInt/parseFloat en JS). La
// cobertura contra un motor MariaDB real está en infra-services-mariadb.test.js.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pool from "../src/db/pool.js";
import * as settingsController from "../src/controllers/settings.controller.js";
import { automationSettingsService } from "../src/services/automation-settings.service.js";
import { schedulerService } from "../src/services/scheduler.service.js";
import { getAdminDashboard } from "../src/services/dashboard.service.js";
import { mockPoolQueries } from "./helpers/pool-mock.js";

after(() => pool.end());

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

// ============================================================
// Email Templates (settings.controller.js)
// ============================================================

test("getEmailTemplates: devuelve las filas tal cual (query ya portable)", async (t) => {
  const rows = [{ id: "venc", subject: "Vencimiento", body: "..." }];
  mockPoolQueries(t, [{ rows }]);

  const req = {};
  const res = fakeRes();
  await settingsController.getEmailTemplates(req, res, (err) => assert.fail(err));

  assert.deepEqual(res.body, rows);
});

test("updateEmailTemplate: 400 si falta subject o body", async (t) => {
  const req = { params: { id: "venc" }, body: { subject: "", body: "" } };
  const res = fakeRes();
  await settingsController.updateEmailTemplate(req, res, (err) => assert.fail(err));

  assert.equal(res.statusCode, 400);
});

test("updateEmailTemplate: hace upsert con placeholders `?` (ON DUPLICATE KEY UPDATE) y devuelve el template", async (t) => {
  let captured;
  const original = pool.query;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [], rowCount: 1 };
  };
  t.after(() => {
    pool.query = original;
  });

  const req = { params: { id: "venc" }, body: { subject: "Nuevo asunto", body: "Nuevo cuerpo" } };
  const res = fakeRes();
  await settingsController.updateEmailTemplate(req, res, (err) => assert.fail(err));

  assert.match(captured.sql, /INSERT INTO email_templates/);
  assert.match(captured.sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(captured.params, ["venc", "Nuevo asunto", "Nuevo cuerpo"]);
  assert.deepEqual(res.body, { id: "venc", subject: "Nuevo asunto", body: "Nuevo cuerpo" });
});

// ============================================================
// Automation Settings (automation-settings.service.js)
// ============================================================

function fakeSettingRow(overrides = {}) {
  return {
    id: "as-1",
    key: "notification_recipients_admin",
    value: JSON.stringify({ emails: ["a@b.com"] }),
    description: "desc",
    enabled: true,
    updated_by: null,
    updated_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

test("automationSettingsService.getAllSettings: parsea value (string JSON, como lo devuelve MariaDB/mysql2) a objeto", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeSettingRow()] }]);

  const rows = await automationSettingsService.getAllSettings();

  assert.deepEqual(rows[0].value, { emails: ["a@b.com"] });
});

test("automationSettingsService.getAllSettings: si value ya viene como objeto (pg con jsonb), no lo toca", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeSettingRow({ value: { emails: [] } })] }]);

  const rows = await automationSettingsService.getAllSettings();

  assert.deepEqual(rows[0].value, { emails: [] });
});

test("automationSettingsService.getSetting: normaliza enabled (TINYINT(1) 0/1 de MariaDB) a boolean real", async (t) => {
  mockPoolQueries(t, [{ rows: [fakeSettingRow({ enabled: 1 })] }]);

  const result = await automationSettingsService.getSetting("notification_recipients_admin");

  assert.strictEqual(result.enabled, true);
});

test("automationSettingsService.getSetting: null si no existe", async (t) => {
  mockPoolQueries(t, [{ rows: [] }]);

  const result = await automationSettingsService.getSetting("no_existe");

  assert.equal(result, null);
});

test("automationSettingsService.updateSetting: UPDATE con COALESCE + SELECT posterior (sin RETURNING)", async (t) => {
  let calls = [];
  const original = pool.query;
  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("UPDATE")) return { rows: [], rowCount: 1 };
    return { rows: [fakeSettingRow({ enabled: false })] };
  };
  t.after(() => {
    pool.query = original;
  });

  const result = await automationSettingsService.updateSetting(
    "notification_recipients_admin",
    { enabled: false },
    "user-1",
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /^UPDATE automation_settings/);
  assert.match(calls[1].sql, /^SELECT \* FROM automation_settings WHERE/);
  assert.equal(result.enabled, false);
});

test("automationSettingsService.addNotificationRecipient: agrega el email sin duplicar", async (t) => {
  let updateParams;
  const original = pool.query;
  let call = 0;
  pool.query = async (sql, params) => {
    call++;
    if (call === 1) return { rows: [fakeSettingRow({ value: JSON.stringify({ emails: ["a@b.com"] }) })] }; // getSetting
    if (call === 2) {
      updateParams = params;
      return { rows: [], rowCount: 1 };
    } // UPDATE
    return { rows: [fakeSettingRow({ value: JSON.stringify({ emails: ["a@b.com", "c@d.com"] }) })] }; // SELECT final
  };
  t.after(() => {
    pool.query = original;
  });

  const result = await automationSettingsService.addNotificationRecipient(
    "admin",
    "c@d.com",
    "user-1",
  );

  assert.deepEqual(JSON.parse(updateParams[0]), { emails: ["a@b.com", "c@d.com"] });
  assert.deepEqual(result.value.emails, ["a@b.com", "c@d.com"]);
});

// ============================================================
// Scheduler (scheduler.service.js)
// ============================================================

test("schedulerService.saveLog: genera un UUID v4 en la app y lo envía explícito (sin RETURNING)", async (t) => {
  let captured;
  const original = pool.query;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [], rowCount: 1 };
  };
  t.after(() => {
    pool.query = original;
  });

  const id = await schedulerService.saveLog({
    jobName: "test_job",
    status: "success",
    startedAt: new Date(),
    finishedAt: new Date(),
    durationMs: 10,
    summary: { ok: true },
    errorMessage: null,
  });

  assert.match(captured.sql, /INSERT INTO scheduler_logs/);
  assert.doesNotMatch(captured.sql, /RETURNING/);
  assert.match(id, UUID_V4);
  assert.equal(captured.params[0], id);
});

test("schedulerService.getLogs: arma placeholders `?` dinámicos según filtros y aplica LIMIT/OFFSET", async (t) => {
  let captured;
  const original = pool.query;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: "log-1" }] };
  };
  t.after(() => {
    pool.query = original;
  });

  const rows = await schedulerService.getLogs({ jobName: "test_job", status: "failed", page: 2, limit: 20 });

  assert.match(captured.sql, /WHERE job_name = \? AND status = \?/);
  assert.deepEqual(captured.params, ["test_job", "failed", 20, 20]);
  assert.equal(rows.length, 1);
});

test("schedulerService.getLogsCount: usa alias `total` y devuelve un número", async (t) => {
  mockPoolQueries(t, [{ rows: [{ total: "7" }] }]);

  const count = await schedulerService.getLogsCount({});

  assert.equal(count, 7);
});

test("schedulerService.getLatestLog: SELECT con placeholder `?` y LIMIT 1", async (t) => {
  let captured;
  const original = pool.query;
  pool.query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: "log-1", job_name: "test_job" }] };
  };
  t.after(() => {
    pool.query = original;
  });

  const log = await schedulerService.getLatestLog("test_job");

  assert.match(captured.sql, /WHERE job_name = \? ORDER BY created_at DESC LIMIT 1/);
  assert.equal(log.id, "log-1");
});

// ============================================================
// Dashboard (dashboard.service.js)
// ============================================================

test("getAdminDashboard: arma el objeto completo con COUNT/SUM parseados en JS (sin cast ::int/::float) y fechas calculadas en Node en vez de NOW()/INTERVAL/DATE_TRUNC", async (t) => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;
  const connectCalls = [];

  pool.connect = async () => ({
    async query(sql, params) {
      connectCalls.push({ sql, params });
      if (sql.includes("active_clients")) {
        return { rows: [{ active_clients: "12", active_services: "34", pending_payments_count: "3" }] };
      }
      if (sql.includes("total_debt")) {
        // Verifica que se bindean fechas (Node) en vez de usar DATE_TRUNC/NOW() sin parámetros
        assert.equal(params.length, 2);
        assert.ok(params[0] instanceof Date);
        return { rows: [{ total_debt: "1500.50", collected_this_month: "800.25" }] };
      }
      if (sql.includes("monthly_revenue")) {
        return { rows: [{ monthly_revenue: "999.99" }] };
      }
      if (sql.includes("overdue_notices")) {
        return { rows: [{ overdue_notices: "2" }] };
      }
      if (sql.includes("new_clients")) {
        assert.equal(params.length, 2);
        return { rows: [{ new_clients: "5" }] };
      }
      if (sql.includes("JOIN hosting_plans hp")) {
        assert.ok(params[0] instanceof Date, "cutoff de 30 días bindeado como parámetro, no INTERVAL");
        return {
          rows: [
            {
              id: "hs-1", domain: "a.com", next_due_date: new Date(), monthly_price: "1200.00",
              status: "active", client_company: "ACME", client_id: "c-1", plan_name: "Plan A",
            },
          ],
        };
      }
      if (sql.includes("GROUP BY c.id, c.company, c.email")) {
        return {
          rows: [
            { id: "c-1", company: "ACME", email: "a@acme.com", debt: "500.00", last_payment_date: null, next_due_date: null },
          ],
        };
      }
      if (sql.includes("FROM payments p")) {
        return {
          rows: [
            { id: "p-1", amount: "100.00", status: "paid", method: "transfer", paid_at: new Date(), period_month: 7, period_year: 2026, client_company: "ACME", service_domain: "a.com" },
          ],
        };
      }
      if (sql.includes("FROM payment_notices n")) {
        return {
          rows: [
            { id: "n-1", notice_number: 1, amount: "200.00", status: "pending", due_date: new Date(), period_month: 7, period_year: 2026, client_company: "ACME", service_domain: "a.com" },
          ],
        };
      }
      if (sql.includes("active_domains")) {
        return { rows: [{ active_domains: "10", due_soon_domains: "1", expired_domains: "0" }] };
      }
      if (sql.includes("FROM domains d")) {
        assert.ok(params[0] instanceof Date);
        return {
          rows: [
            { id: "d-1", domain: "a.com", expiration_date: new Date(), status: "active", client_company: "ACME", service_domain: "a.com" },
          ],
        };
      }
      if (sql.includes("open_tickets")) {
        return { rows: [{ open_tickets: "4", urgent_tickets: "1" }] };
      }
      if (sql.includes("FROM support_tickets t")) {
        return {
          rows: [
            { id: "t-1", ticket_number: 1, subject: "Ayuda", status: "open", priority: "urgent", created_at: new Date(), assigned_to: "u-1", last_message_at: new Date(), client_company: "ACME", assigned_user_name: "Juan" },
          ],
        };
      }
      if (sql.includes("pending_tasks")) {
        return { rows: [{ pending_tasks: "6", urgent_tasks: "2" }] };
      }
      if (sql.includes("overdue_tasks")) {
        assert.equal(typeof params[0], "string");
        assert.match(params[0], /^\d{4}-\d{2}-\d{2}$/, "NOW()::date reemplazado por fecha 'YYYY-MM-DD' bindeada");
        return { rows: [{ overdue_tasks: "1" }] };
      }
      if (sql.includes("FROM internal_tasks t")) {
        assert.equal(params.length, 2);
        assert.match(params[0], /^\d{4}-\d{2}-\d{2}$/);
        assert.match(params[1], /^\d{4}-\d{2}-\d{2}$/);
        return {
          rows: [
            { id: "task-1", title: "Revisar", status: "pending", priority: "urgent", due_date: new Date(), assigned_to: "u-1", client_name: "ACME", assigned_user_name: "Juan" },
          ],
        };
      }
      throw new Error(`Query no esperada en el mock: ${sql}`);
    },
    release() {},
  });

  pool.query = async (sql, params) => {
    assert.match(sql, /FROM audit_logs/);
    assert.deepEqual(params, [10]);
    return { rows: [{ id: "log-1", action: "crear" }] };
  };

  t.after(() => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  });

  const dashboard = await getAdminDashboard();

  assert.equal(connectCalls.length, 16);

  assert.equal(dashboard.activeClients, 12);
  assert.equal(dashboard.activeServices, 34);
  assert.equal(dashboard.pendingPaymentsCount, 3);
  assert.equal(dashboard.monthlyRevenue, 999.99);
  assert.equal(dashboard.collectedThisMonth, 800.25);
  assert.equal(dashboard.totalDebt, 1500.5);
  assert.equal(dashboard.overdueNoticesCount, 2);
  assert.equal(dashboard.newClientsThisMonth, 5);

  assert.equal(dashboard.upcomingServices[0].monthlyPrice, 1200);
  assert.equal(dashboard.clientsWithDebt[0].debt, 500);
  assert.equal(dashboard.recentPayments[0].amount, 100);
  assert.equal(dashboard.recentNotices[0].amount, 200);

  assert.equal(dashboard.activeDomainsCount, 10);
  assert.equal(dashboard.dueSoonDomainsCount, 1);
  assert.equal(dashboard.expiredDomainsCount, 0);

  assert.equal(dashboard.openTicketsCount, 4);
  assert.equal(dashboard.urgentTicketsCount, 1);
  assert.equal(dashboard.pendingTasksCount, 6);
  assert.equal(dashboard.urgentTasksCount, 2);
  assert.equal(dashboard.overdueTasksCount, 1);

  assert.equal(dashboard.recentActivity[0].id, "log-1");
});
