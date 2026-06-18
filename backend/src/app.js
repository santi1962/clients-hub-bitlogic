import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import config from "./config/index.js";
import pool from "./db/pool.js";
import settingsRoutes from "./routes/settings.routes.js";
import plansRoutes from "./routes/plans.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import hostingRoutes from "./routes/hosting.routes.js";
import domainsRoutes from "./routes/domains.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import supportRoutes from "./routes/support.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import emailRoutes from "./routes/email.routes.js";
import hestiaRoutes from "./routes/hestia.routes.js";
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

// Login para admin y clientes
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Admin hardcodeado
  if (email === "admin@bitlogic.com.ar" && password === "Cambiar123!") {
    const token = jwt.sign(
      { sub: "admin", role: "super_admin" },
      config.jwt.accessSecret,
      { expiresIn: "1h" }
    );
    return res.json({
      accessToken: token,
      user: {
        id: "admin",
        name: "Admin Bitlogic",
        email: "admin@bitlogic.com.ar",
        role: "super_admin",
        phone: null,
        clientId: null,
        lastLoginAt: new Date().toISOString(),
      },
    });
  }

  // Buscar usuario en BD (clientes)
  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, name, role, status, client_id FROM users WHERE email = $1 AND status = 'active'",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" } });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" } });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, clientId: user.client_id },
      config.jwt.accessSecret,
      { expiresIn: "1h" }
    );

    res.json({
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
        phone: null,
        lastLoginAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message: "Error en el servidor" } });
  }
});

app.use("/api/settings", settingsRoutes);
app.use("/api/hosting/plans", plansRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/hosting", hostingRoutes);
app.use("/api/domains", domainsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/hestia", hestiaRoutes);

// ── Scheduler Registration ────────────────────────────────────
// (Disabled for setup-inicial testing)

// ── Endpoint /api/auth/me (ANTES del errorHandler)
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "NO_AUTH", message: "Token requerido" } });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    res.json({
      id: decoded.sub || "admin",
      name: "Admin Bitlogic",
      email: "admin@bitlogic.com.ar",
      role: decoded.role || "super_admin",
      phone: null,
      clientId: null,
      lastLoginAt: new Date().toISOString(),
    });
  } catch {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
  }
});

// ── Manejo de errores ─────────────────────────────────────────
app.use(errorHandler);

export default app;
