import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config/index.js";
import pool from "./db/pool.js";
import authRoutes from "./routes/auth.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import plansRoutes from "./routes/plans.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import hostingRoutes from "./routes/hosting.routes.js";
import domainsRoutes from "./routes/domains.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import supportRoutes from "./routes/support.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import usersRoutes from "./routes/users.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import emailRoutes from "./routes/email.routes.js";
import telegramRoutes from "./routes/telegram.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import hestiaRoutes from "./routes/hestia.routes.js";
import automationSettingsRoutes from "./routes/automation-settings.routes.js";
import schedulerRoutes from "./routes/scheduler.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import backupsRoutes from "./routes/backups.routes.js";
import mercadopagoRoutes from "./routes/mercadopago.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRequired } from "./middlewares/authRequired.js";
import { requireStaff } from "./middlewares/requireRole.js";

const app = express();

// ── Seguridad ─────────────────────────────────────────────────
// crossOriginResourcePolicy en "cross-origin": el frontend (puerto Vite)
// y el backend corren en orígenes distintos, y el frontend carga imágenes
// (logo, adjuntos) servidas por este backend vía <img src>.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.cors.origin, credentials: true }));

// ── Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Los uploads se sirven sólo a través del endpoint autenticado /api/uploads/tickets/:filename

// ── Health check ──────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  let database = "connected";
  try {
    await pool.query("SELECT 1");
  } catch {
    database = "disconnected";
  }
  res.status(database === "connected" ? 200 : 503).json({
    status: database === "connected" ? "ok" : "degraded",
    service: "bitlogic-backend",
    database,
    timestamp: new Date().toISOString(),
  });
});

// ── System Status ──────────────────────────────────────────────
app.get("/api/system/status", authRequired, requireStaff, async (_req, res) => {
  const results = {
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: "unknown",
    smtp: "unknown",
    hestia: "unknown",
    scheduler: "unknown",
    stats: { clients: 0, services: 0, domains: 0, tickets_open: 0, tasks_pending: 0 },
  };

  try {
    await pool.query("SELECT 1");
    results.database = "ok";
  } catch {
    results.database = "error";
  }

  results.smtp = config.smtp.host && config.smtp.user ? "configured" : "unconfigured";
  results.hestia = config.hestia.url && config.hestia.apiKey ? "configured" : "unconfigured";

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
    const schedulerCheck = await pool.query(
      "SELECT status FROM scheduler_logs WHERE created_at > $1 LIMIT 1",
      [fiveMinutesAgo]
    );
    results.scheduler = schedulerCheck.rows.length > 0 ? "active" : "idle";
  } catch {
    results.scheduler = "unknown";
  }

  try {
    const stats = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM clients WHERE status = 'active'").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM hosting_services WHERE status IN ('active', 'due_soon', 'pending_payment')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM domains WHERE status IN ('active', 'due_soon')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'waiting_client')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM internal_tasks WHERE status = 'pending'").catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    results.stats.clients = parseInt(stats[0].rows[0]?.count || 0);
    results.stats.services = parseInt(stats[1].rows[0]?.count || 0);
    results.stats.domains = parseInt(stats[2].rows[0]?.count || 0);
    results.stats.tickets_open = parseInt(stats[3].rows[0]?.count || 0);
    results.stats.tasks_pending = parseInt(stats[4].rows[0]?.count || 0);
  } catch (err) {
    console.error("[System] Error getting stats:", err.message);
  }

  res.status(results.database === "ok" ? 200 : 503).json(results);
});

// ── Rutas ─────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/hosting/plans", plansRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/hosting", hostingRoutes);
app.use("/api/domains", domainsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/hestia", hestiaRoutes);
app.use("/api/automation-settings", automationSettingsRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/backups", backupsRoutes);
app.use("/api/portal/payments", mercadopagoRoutes);
app.use("/api/webhooks", mercadopagoRoutes);
app.use("/api/audit", auditRoutes);

// ── Manejo de errores ─────────────────────────────────────────
app.use(errorHandler);

export default app;
