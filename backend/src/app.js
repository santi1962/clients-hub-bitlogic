import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import config from "./config/index.js";
import pool from "./db/pool.js";
import settingsRoutes from "./routes/settings.routes.js";
import plansRoutes from "./routes/plans.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import hostingRoutes from "./routes/hosting.routes.js";
import domainsRoutes from "./routes/domains.routes.js";
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

// Login temporal para setup
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@bitlogic.com.ar" && password === "Cambiar123!") {
    const token = jwt.sign(
      { sub: "admin", role: "super_admin" },
      config.jwt.accessSecret,
      { expiresIn: "1h" }
    );
    return res.json({ accessToken: token, user: { email, role: "super_admin" } });
  }
  res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" } });
});

app.use("/api/settings", settingsRoutes);
app.use("/api/hosting/plans", plansRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/hosting", hostingRoutes);
app.use("/api/domains", domainsRoutes);

// ── Scheduler Registration ────────────────────────────────────
// (Disabled for setup-inicial testing)

// ── Manejo de errores ─────────────────────────────────────────
app.use(errorHandler);

export default app;
