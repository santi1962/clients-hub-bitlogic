// Fixture ejecutado en un proceso hijo separado por infra-services-mariadb.test.js
// (Fase DB-3I: Email Templates + Automation Settings + Scheduler + Dashboard).
// Corre contra el schema.sql COMPLETO (aplicado por apply-mariadb-schema.mjs
// antes de invocar este archivo) — automation_settings/company_settings
// dependen de triggers con DELIMITER, mismo motivo que support/settings.
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import pool from "../../src/db/pool.js";
import { schedulerService } from "../../src/services/scheduler.service.js";
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
  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };

  const clientId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, company, email, status) VALUES (?, 'Cliente Fixture', 'ACME', 'cliente@fixture.test', 'active')`, [clientId]);

  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price, status) VALUES (?, 'Plan Fixture', 10, 1200.00, 'active')`, [planId]);

  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price, status)
     VALUES (?, ?, ?, 'servicio-fixture.test', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 10, 1200.00, 'active')`,
    [serviceId, clientId, planId],
  );

  await pool.query(
    `INSERT INTO payments (id, client_id, hosting_service_id, amount, status, method, paid_at, period_month, period_year)
     VALUES (?, ?, ?, 500.00, 'paid', 'transfer', NOW(), MONTH(NOW()), YEAR(NOW()))`,
    [randomUUID(), clientId, serviceId],
  );
  await pool.query(
    `INSERT INTO payments (id, client_id, hosting_service_id, amount, status, period_month, period_year)
     VALUES (?, ?, ?, 300.00, 'pending', MONTH(NOW()), YEAR(NOW()))`,
    [randomUUID(), clientId, serviceId],
  );

  await pool.query(
    `INSERT INTO payment_notices (id, client_id, hosting_service_id, notice_number, amount, status, due_date, period_month, period_year)
     VALUES (?, ?, ?, 1, 300.00, 'overdue', DATE_SUB(CURDATE(), INTERVAL 5 DAY), MONTH(NOW()), YEAR(NOW()))`,
    [randomUUID(), clientId, serviceId],
  );

  await pool.query(
    `INSERT INTO domains (id, client_id, hosting_service_id, domain, registration_date, expiration_date, status)
     VALUES (?, ?, ?, 'servicio-fixture.test', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'due_soon')`,
    [randomUUID(), clientId, serviceId],
  );

  await pool.query(
    `INSERT INTO support_tickets (id, client_id, subject, status, priority) VALUES (?, ?, 'Ticket urgente fixture', 'open', 'urgent')`,
    [randomUUID(), clientId],
  );

  await pool.query(
    `INSERT INTO internal_tasks (id, title, status, priority, due_date, client_id, assigned_to)
     VALUES (?, 'Tarea vencida fixture', 'pending', 'urgent', DATE_SUB(CURDATE(), INTERVAL 2 DAY), ?, ?)`,
    [randomUUID(), clientId, adminId],
  );
  await pool.query(
    `INSERT INTO internal_tasks (id, title, status, priority, due_date, client_id, assigned_to)
     VALUES (?, 'Tarea próxima fixture', 'pending', 'normal', DATE_ADD(CURDATE(), INTERVAL 3 DAY), ?, ?)`,
    [randomUUID(), clientId, adminId],
  );

  const { baseUrl, close } = await startEphemeralServer(app);

  try {
    // ── Dashboard: valores determinísticos calculados a partir del seed de
    // arriba, deben coincidir con los mismos cómputos que corren bajo
    // Postgres (misma lógica de dashboard.service.js, sin DATE_TRUNC ni
    // ::int/::float ni INTERVAL de Postgres — portable por diseño) ──
    const dashboardRes = await fetch(`${baseUrl}/api/dashboard/admin`, { headers: adminHeaders });
    assert.equal(dashboardRes.status, 200);
    const dashboard = await dashboardRes.json();

    assert.equal(dashboard.activeClients, 1);
    assert.equal(dashboard.activeServices, 1);
    assert.equal(dashboard.pendingPaymentsCount, 1);
    assert.equal(dashboard.monthlyRevenue, 1200);
    assert.equal(dashboard.collectedThisMonth, 500);
    assert.equal(dashboard.totalDebt, 300);
    assert.equal(dashboard.overdueNoticesCount, 1);
    assert.equal(dashboard.newClientsThisMonth, 1);
    assert.equal(dashboard.activeDomainsCount, 0);
    assert.equal(dashboard.dueSoonDomainsCount, 1);
    assert.equal(dashboard.openTicketsCount, 1);
    assert.equal(dashboard.urgentTicketsCount, 1);
    assert.equal(dashboard.pendingTasksCount, 2);
    assert.equal(dashboard.urgentTasksCount, 1);
    assert.equal(dashboard.overdueTasksCount, 1, "NOW()::date de Postgres reemplazado por CURDATE() bindeado en Node, debe seguir contando la tarea vencida");
    assert.ok(dashboard.upcomingServices.some((s) => s.id === serviceId));
    assert.ok(dashboard.clientsWithDebt.some((c) => c.id === clientId && c.debt === 300));
    assert.ok(dashboard.upcomingDomains.length === 1, "vencimiento a 15 días debe entrar dentro de la ventana de 30 días calculada en Node");
    assert.ok(dashboard.upcomingTasks.some((t) => t.title === "Tarea próxima fixture"));
    assert.ok(!dashboard.upcomingTasks.some((t) => t.title === "Tarea vencida fixture"), "una tarea ya vencida no debe aparecer en 'próximas' (queda en overdueTasksCount)");
    assert.ok(typeof dashboard.recentActivity === "object");

    // ── Email Templates: upsert con ON DUPLICATE KEY UPDATE (variante MariaDB) ──
    const createTemplateRes = await fetch(`${baseUrl}/api/settings/templates/venc_fixture`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ subject: "Aviso de vencimiento", body: "Tu servicio vence pronto" }),
    });
    assert.equal(createTemplateRes.status, 200);
    const created = await createTemplateRes.json();
    assert.equal(created.subject, "Aviso de vencimiento");

    const updateTemplateRes = await fetch(`${baseUrl}/api/settings/templates/venc_fixture`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ subject: "Aviso actualizado", body: "Cuerpo actualizado" }),
    });
    assert.equal(updateTemplateRes.status, 200);
    const updated = await updateTemplateRes.json();
    assert.equal(updated.subject, "Aviso actualizado", "el segundo PUT debe actualizar (ON DUPLICATE KEY UPDATE), no fallar por PK duplicada");

    const listTemplatesRes = await fetch(`${baseUrl}/api/settings/templates`, { headers: adminHeaders });
    const templates = await listTemplatesRes.json();
    assert.ok(templates.some((t) => t.id === "venc_fixture" && t.subject === "Aviso actualizado"));

    // ── Automation Settings: columna reservada `key` (backticks bajo
    // MariaDB, ver KEY_COL en automation-settings.service.js) ──
    const listSettingsRes = await fetch(`${baseUrl}/api/automation-settings`, { headers: adminHeaders });
    assert.equal(listSettingsRes.status, 200);
    const settingsList = await listSettingsRes.json();
    assert.ok(settingsList.data.length >= 8, "deben estar los 8 defaults sembrados por el INSERT IGNORE de schema.sql");
    assert.ok(settingsList.data.every((s) => typeof s.value === "object"), "value (JSON de MariaDB) debe llegar ya parseado a objeto, no como string");

    const getSettingRes = await fetch(`${baseUrl}/api/automation-settings/hestia_sync_enabled`, { headers: adminHeaders });
    assert.equal(getSettingRes.status, 200);

    const getMissingSettingRes = await fetch(`${baseUrl}/api/automation-settings/no_existe`, { headers: adminHeaders });
    assert.equal(getMissingSettingRes.status, 404);

    const toggleRes = await fetch(`${baseUrl}/api/automation-settings/hestia_sync_enabled/toggle`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(toggleRes.status, 200);
    const toggled = await toggleRes.json();
    assert.equal(toggled.data.enabled, true, "hestia_sync_enabled arranca en false por default, el toggle debe pasarlo a true");

    const addRecipientRes = await fetch(`${baseUrl}/api/automation-settings/admin/recipients`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ email: "alerta@fixture.test" }),
    });
    assert.equal(addRecipientRes.status, 200);
    assert.ok((await addRecipientRes.json()).data.value.emails.includes("alerta@fixture.test"));

    const removeRecipientRes = await fetch(`${baseUrl}/api/automation-settings/admin/recipients`, {
      method: "DELETE",
      headers: adminHeaders,
      body: JSON.stringify({ email: "alerta@fixture.test" }),
    });
    assert.equal(removeRecipientRes.status, 200);
    assert.ok(!(await removeRecipientRes.json()).data.value.emails.includes("alerta@fixture.test"));

    // ── Scheduler: registra un job de prueba en memoria (initScheduler() de
    // producción no corre en este fixture, así que se registra a mano),
    // ejecuta vía el endpoint HTTP, y valida que saveLog generó un UUID v4
    // real en la app (sin depender del DEFAULT (UUID()) retirado del schema) ──
    schedulerService.registerJob("fixture_job", "Job de prueba del fixture", async () => ({ processed: 3 }));

    const runJobRes = await fetch(`${baseUrl}/api/scheduler/jobs/fixture_job/run`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(runJobRes.status, 200);
    const runResult = await runJobRes.json();
    assert.equal(runResult.log.status, "success");

    const { rows: logRows } = await pool.query(`SELECT id, job_name, status FROM scheduler_logs WHERE job_name = ?`, ["fixture_job"]);
    assert.equal(logRows.length, 1);
    assert.match(logRows[0].id, UUID_V4, "scheduler_logs.id debe ser un UUID v4 generado por la app (DEFAULT (UUID()) retirado en DB-3I)");

    const jobsListRes = await fetch(`${baseUrl}/api/scheduler/jobs`, { headers: adminHeaders });
    const jobsList = await jobsListRes.json();
    assert.ok(jobsList.data.some((j) => j.name === "fixture_job"));

    const logsRes = await fetch(`${baseUrl}/api/scheduler/logs?jobName=fixture_job`, { headers: adminHeaders });
    const logsBody = await logsRes.json();
    assert.equal(logsBody.data.length, 1);
    assert.equal(logsBody.meta.total, 1, "getLogsCount debe devolver un número real (alias `total` portable)");

    const latestRes = await fetch(`${baseUrl}/api/scheduler/jobs/fixture_job/latest`, { headers: adminHeaders });
    assert.equal(latestRes.status, 200);
    assert.equal((await latestRes.json()).data.job_name, "fixture_job");

    // segunda ejecución concurrente debe rechazarse (lock en memoria, no cambia con el motor)
    schedulerService.registerJob("fixture_job_slow", "Job lento de prueba del fixture", async () => {
      await new Promise((r) => setTimeout(r, 200));
      return { processed: 1 };
    });
    const [concurrent1, concurrent2] = await Promise.all([
      fetch(`${baseUrl}/api/scheduler/jobs/fixture_job_slow/run`, { method: "POST", headers: adminHeaders }),
      fetch(`${baseUrl}/api/scheduler/jobs/fixture_job_slow/run`, { method: "POST", headers: adminHeaders }),
    ]);
    const statuses = [concurrent1.status, concurrent2.status].sort();
    assert.deepEqual(statuses, [200, 409], "ejecución concurrente del mismo job debe rechazarse con 409 (lock en memoria, no en DB)");

    console.log("MARIADB_INFRA_SERVICES_FLOW_OK");
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
