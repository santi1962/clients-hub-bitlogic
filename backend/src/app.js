import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config/index.js";
import pool from "./db/pool.js";
import authRoutes from "./routes/auth.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import hostingRoutes from "./routes/hosting.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import domainsRoutes from "./routes/domains.routes.js";
import supportRoutes from "./routes/support.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import emailRoutes from "./routes/email.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import hestiaRoutes from "./routes/hestia.routes.js";
import schedulerRoutes from "./routes/scheduler.routes.js";
import automationSettingsRoutes from "./routes/automation-settings.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { schedulerService } from "./services/scheduler.service.js";
import { paymentRemindersDaily } from "./jobs/payment-reminders.job.js";
import { delinquencyDetectionDaily } from "./jobs/delinquency-detection.job.js";
import { hestiaSyncDaily } from "./jobs/hestia-sync.job.js";

const app = express();

// ── Seguridad ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));

// ── Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

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

// ── System Status (Fase 4F) ────────────────────────────────────
app.get("/api/system/status", async (_req, res) => {
  const startTime = process.uptime();
  const results = {
    version: "1.0.0",
    uptime: Math.floor(startTime),
    timestamp: new Date().toISOString(),
    database: "unknown",
    smtp: "unknown",
    hestia: "unknown",
    scheduler: "unknown",
    stats: {
      clients: 0,
      services: 0,
      domains: 0,
      tickets_open: 0,
      tasks_pending: 0,
    },
  };

  // Check database
  try {
    await pool.query("SELECT 1");
    results.database = "ok";
  } catch {
    results.database = "error";
  }

  // Check SMTP
  try {
    const smtpHost = config.smtp.host;
    const smtpUser = config.smtp.user;
    results.smtp = smtpHost && smtpUser ? "configured" : "unconfigured";
  } catch {
    results.smtp = "error";
  }

  // Check Hestia
  try {
    const hestiaUrl = config.hestia.url;
    const hestiaKey = config.hestia.apiKey;
    results.hestia = hestiaUrl && hestiaKey ? "configured" : "unconfigured";
  } catch {
    results.hestia = "error";
  }

  // Check scheduler (last 5 minute)
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

  // Get stats
  try {
    const stats = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM clients WHERE status = 'active'").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM hosting_services WHERE status IN ('active', 'due_soon', 'pending_payment')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM domains WHERE status IN ('activo', 'proximo_a_vencer')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('open', 'waiting_customer')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT 0 as count").catch(() => ({ rows: [{ count: 0 }] })), // tasks table doesn't exist yet
    ]);

    results.stats.clients = parseInt(stats[0].rows[0]?.count || 0);
    results.stats.services = parseInt(stats[1].rows[0]?.count || 0);
    results.stats.domains = parseInt(stats[2].rows[0]?.count || 0);
    results.stats.tickets_open = parseInt(stats[3].rows[0]?.count || 0);
    results.stats.tasks_pending = 0; // Placeholder until tasks table exists
  } catch (err) {
    console.error("[System] Error getting stats:", err.message);
  }

  const isHealthy = results.database === "ok";
  res.status(isHealthy ? 200 : 503).json(results);
});

// ── Rutas ─────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/hosting", hostingRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/domains", domainsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/hestia", hestiaRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/automation-settings", automationSettingsRoutes);

// ── Scheduler Registration ────────────────────────────────────
// Phase 4E.1: Register jobs (no automatic cron yet)
schedulerService.registerJob(
  "payment_reminders_daily",
  "Detect payment notices due soon (7, 3, 0, -7 days)",
  paymentRemindersDaily,
);
schedulerService.registerJob(
  "delinquency_detection_daily",
  "Detect overdue payments and services (>7 days)",
  delinquencyDetectionDaily,
);
schedulerService.registerJob(
  "hestia_sync_daily",
  "List services with HestiaCP usernames (ready for sync)",
  hestiaSyncDaily,
);

// ── Manejo de errores ─────────────────────────────────────────
app.use(errorHandler);

export default app;
