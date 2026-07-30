// Fixture ejecutado en un proceso hijo por full-app-mariadb-smoke.test.js
// (Fase DB-3K): a diferencia de todos los demás fixtures *-mariadb (que
// importan app.js EN PROCESO vía startEphemeralServer), este arranca
// `src/server.js` como un proceso de sistema operativo aparte — es la única
// forma real de probar el arranque completo (chequeo de conexión, Socket.IO,
// scheduler, apagado ordenado con SIGTERM), no solo el router de Express.
if (process.env.MARIADB_FIXTURE_RUN !== "1") {
  process.exit(0);
}

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import pool from "../../src/db/pool.js";
import { signAccessToken } from "../../src/utils/jwt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.join(__dirname, "..", "..", "src", "server.js");
const PASSWORD = "Password123!";

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.once("error", reject);
  });
}

async function waitForLog(child, pattern, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`Timeout esperando "${pattern}" en stdout. Salida hasta ahora:\n${buf}`)), timeoutMs);
    function onData(chunk) {
      buf += chunk.toString();
      if (pattern.test(buf)) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve(buf);
      }
    }
    child.stdout.on("data", onData);
  });
}

async function run() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, 'Admin Smoke', 'admin@smoke.test', ?, 'super_admin', 'active')`,
    [adminId, passwordHash],
  );

  const clientId = randomUUID();
  await pool.query(`INSERT INTO clients (id, name, company, email, status) VALUES (?, 'Cliente Smoke', 'SMOKE', 'cliente@smoke.test', 'active')`, [clientId]);
  const planId = randomUUID();
  await pool.query(`INSERT INTO hosting_plans (id, name, storage_gb, monthly_price, status) VALUES (?, 'Plan Smoke', 10, 500.00, 'active')`, [planId]);
  const serviceId = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services (id, client_id, plan_id, domain, setup_date, next_due_date, storage_total_gb, monthly_price, status)
     VALUES (?, ?, ?, 'smoke-service.test', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 10, 500.00, 'active')`,
    [serviceId, clientId, planId],
  );
  const domainId = randomUUID();
  await pool.query(
    `INSERT INTO domains (id, client_id, hosting_service_id, domain, expiration_date, status) VALUES (?, ?, ?, 'smoke-domain.test', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'active')`,
    [domainId, clientId, serviceId],
  );
  const ticketId = randomUUID();
  await pool.query(
    `INSERT INTO support_tickets (id, client_id, subject, status) VALUES (?, ?, 'Ticket smoke', 'open')`,
    [ticketId, clientId],
  );
  const taskId = randomUUID();
  await pool.query(
    `INSERT INTO internal_tasks (id, title, status, client_id) VALUES (?, 'Tarea smoke', 'pending', ?)`,
    [taskId, clientId],
  );
  const noticeId = randomUUID();
  await pool.query(
    `INSERT INTO payment_notices (id, client_id, hosting_service_id, notice_number, period_month, period_year, due_date, amount, status)
     VALUES (?, ?, ?, 'AV-SMOKE-0001', 7, 2026, CURDATE(), 500.00, 'pending')`,
    [noticeId, clientId, serviceId],
  );
  const portalUserId = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status, client_id) VALUES (?, 'Portal Smoke', 'portal@smoke.test', ?, 'cliente', 'active', ?)`,
    [portalUserId, passwordHash, clientId],
  );

  const adminToken = signAccessToken({ sub: adminId, role: "super_admin", clientId: null });
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };
  // authRequired reconsulta rol/client_id reales desde `users` por `sub` —
  // el token solo necesita apuntar a la fila correcta, no puede "forzar" un
  // rol distinto al que tiene esa fila en la base.
  const portalToken = signAccessToken({ sub: portalUserId, role: "cliente", clientId });

  await pool.end(); // este script no necesita más queries propias — el server hijo abre su propio pool

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(port),
      SCHEDULER_ENABLED: "false",
      NODE_ENV: "development", // igual que dev real; producción exigiría secrets que no vamos a cargar acá
      WHATSAPP_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stderr.on("data", (c) => { stderrBuf += c.toString(); });

  try {
    await waitForLog(child, /Bitlogic Backend iniciado/, 15_000);

    // ── 1. health/live, health/ready ──
    const liveRes = await fetch(`${baseUrl}/api/health/live`);
    assert.equal(liveRes.status, 200);
    const readyRes = await fetch(`${baseUrl}/api/health/ready`);
    assert.equal(readyRes.status, 200, "readiness debe pasar contra MariaDB (SELECT 1 real)");
    const readyBody = await readyRes.json();
    assert.equal(readyBody.checks?.status ?? readyBody.status, "ok");

    // ── 2. login + refresh ──
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@smoke.test", password: PASSWORD }),
    });
    assert.equal(loginRes.status, 200, "login real contra MariaDB debe funcionar");
    const loginBody = await loginRes.json();
    assert.ok(loginBody.accessToken);
    const setCookie = loginRes.headers.get("set-cookie");
    assert.ok(setCookie, "login debe setear la cookie de refresh token");

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: setCookie.split(";")[0] },
    });
    assert.equal(refreshRes.status, 200, "refresh real contra MariaDB debe funcionar");

    // ── 3. usuarios, clientes, planes, hosting, dominios, tickets, tareas ──
    for (const url of [
      "/api/users/portal",
      "/api/clients",
      "/api/hosting/plans",
      "/api/hosting/services",
      "/api/domains",
      "/api/support",
      "/api/tasks",
    ]) {
      const r = await fetch(`${baseUrl}${url}`, { headers: adminHeaders });
      assert.equal(r.status, 200, `${url} debe responder 200`);
    }

    // ── 4. settings, templates, automation settings, scheduler (solo lectura) ──
    const settingsRes = await fetch(`${baseUrl}/api/settings/company`, { headers: adminHeaders });
    assert.equal(settingsRes.status, 200);
    const templatesRes = await fetch(`${baseUrl}/api/settings/templates`, { headers: adminHeaders });
    assert.equal(templatesRes.status, 200);
    const automationRes = await fetch(`${baseUrl}/api/automation-settings`, { headers: adminHeaders });
    assert.equal(automationRes.status, 200);
    const schedulerJobsRes = await fetch(`${baseUrl}/api/scheduler/jobs`, { headers: adminHeaders });
    assert.equal(schedulerJobsRes.status, 200, "listar jobs registrados debe funcionar aunque SCHEDULER_ENABLED=false (solo no se auto-ejecutan)");
    const schedulerLogsRes = await fetch(`${baseUrl}/api/scheduler/logs`, { headers: adminHeaders });
    assert.equal(schedulerLogsRes.status, 200);

    // ── 5. dashboard ──
    const dashboardRes = await fetch(`${baseUrl}/api/dashboard/admin`, { headers: adminHeaders });
    assert.equal(dashboardRes.status, 200);
    const analyticsRes = await fetch(`${baseUrl}/api/dashboard/analytics`, { headers: adminHeaders });
    assert.equal(analyticsRes.status, 200, "analyticsData (hallazgo de esta fase) debe responder 200 contra MariaDB");
    const analyticsBody = await analyticsRes.json();
    assert.equal(analyticsBody.revenue_trend.length, 6);
    assert.equal(analyticsBody.client_trend.length, 6);

    // ── 6. avisos de pago, pagos, cobranza ──
    const noticesRes = await fetch(`${baseUrl}/api/billing/notices`, { headers: adminHeaders });
    assert.equal(noticesRes.status, 200);
    const paymentsRes = await fetch(`${baseUrl}/api/billing/payments`, { headers: adminHeaders });
    assert.equal(paymentsRes.status, 200);
    const billingSummaryRes = await fetch(`${baseUrl}/api/billing/summary`, { headers: adminHeaders });
    assert.equal(billingSummaryRes.status, 200);

    // ── 7. backups MariaDB reales (dump real contra la base descartable) ──
    const createBackupRes = await fetch(`${baseUrl}/api/backups`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ notes: "Backup de smoke test" }),
    });
    assert.equal(createBackupRes.status, 202);
    const backup = await createBackupRes.json();
    assert.match(backup.id, /^[0-9a-f-]{36}$/i);
    // el dump corre en background (fire-and-forget) — esperar un momento y
    // confirmar que terminó en 'success' (mariadb-dump/mysqldump real).
    let backupStatus;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const listRes = await fetch(`${baseUrl}/api/backups`, { headers: adminHeaders });
      const list = await listRes.json();
      const found = list.find((b) => b.id === backup.id);
      backupStatus = found?.status;
      if (backupStatus === "success" || backupStatus === "failed") break;
    }
    assert.equal(backupStatus, "success", "el dump real con mariadb-dump/mysqldump debe terminar en success");

    // ── 8. portal cliente ──
    const portalRes = await fetch(`${baseUrl}/api/portal/tickets`, {
      headers: { Authorization: `Bearer ${portalToken}` },
    });
    assert.equal(portalRes.status, 200, "portal del cliente debe responder 200 con un usuario real de rol cliente");

    // ── 9. Socket.IO (handshake Engine.IO, sin cliente socket.io-client) ──
    const socketRes = await fetch(`${baseUrl}/socket.io/?EIO=4&transport=polling`);
    assert.equal(socketRes.status, 200, "el handshake de Engine.IO debe responder 200 -> Socket.IO está inicializado");
    const socketBody = await socketRes.text();
    assert.match(socketBody, /"sid":/, "la respuesta debe incluir un session id de Engine.IO");

    // ── 10. uploads (política ya cubierta en detalle por uploads.test.js —
    // acá solo se confirma que el endpoint responde bajo MariaDB) ──
    const badUploadForm = new FormData();
    badUploadForm.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "application/x-msdownload" }), "malware.exe");
    const uploadRes = await fetch(`${baseUrl}/api/support/${ticketId}/messages`, {
      method: "POST",
      headers: { Authorization: adminHeaders.Authorization },
      body: badUploadForm,
    });
    assert.equal(uploadRes.status, 400, "tipo de archivo no permitido debe seguir dando 400 contra MariaDB");

    console.log("MARIADB_FULL_APP_SMOKE_HTTP_OK");

    // ── 11. apagado ante SIGTERM ──
    // En Windows, `child_process.kill('SIGTERM')` no se puede interceptar:
    // Node documenta que en ese SO cualquier señal enviada a un hijo termina
    // el proceso incondicionalmente (no hay señales POSIX reales) — por eso
    // acá solo se confirma que el proceso efectivamente termina en un tiempo
    // acotado, sin colgarse. La lógica de apagado ordenado de server.js
    // (stopScheduler/closeSocket/pool.end, sin ninguna rama específica de
    // motor) ya se revisó por código; en Linux (VPS real, con systemd/PM2)
    // SIGTERM sí se entrega como señal real y ejercita ese camino completo.
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 15_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
      child.kill("SIGTERM");
    });
    assert.ok(exited, "el proceso debe terminar (con o sin apagado ordenado interceptable, según el SO) tras enviarle SIGTERM, sin quedar colgado");

    console.log("MARIADB_FULL_APP_SMOKE_OK");
  } catch (err) {
    console.error("--- stderr del server hijo ---\n" + stderrBuf);
    if (!child.killed) child.kill("SIGKILL");
    throw err;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
