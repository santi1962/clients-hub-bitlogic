/**
 * Scheduler Service
 * Manages job registration, execution, and logging.
 *
 * El lock de "un job a la vez" (runningJobs) es compartido entre disparo
 * manual (panel) y disparo automático (cron) porque ambos pasan por
 * executeJob(). Para una sola instancia PM2 (fork), un Set en memoria
 * alcanza. Si algún día el backend corre en más de una instancia, este
 * lock deja de servir — hace falta un lock en PostgreSQL (ej. pg_advisory_lock)
 * compartido entre procesos.
 */
import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("scheduler");

// In-memory job registry
const jobs = new Map();
const runningJobs = new Set();

/** Saca de un mensaje de error patrones obvios de secretos antes de guardarlo. */
function sanitizeErrorMessage(message) {
  if (!message) return message;
  return String(message)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgres://[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

export const schedulerService = {
  /**
   * Register a job
   */
  registerJob(jobName, description, jobFn) {
    if (jobs.has(jobName)) {
      log.warn(`Job "${jobName}" ya estaba registrado, se sobreescribe la definición anterior`);
    }
    jobs.set(jobName, {
      name: jobName,
      description,
      fn: jobFn,
      lastRun: null,
    });
    log.info(`Job registrado: ${jobName}`);
  },

  /**
   * Get all registered jobs
   */
  getJobs() {
    return Array.from(jobs.values()).map((job) => ({
      name: job.name,
      description: job.description,
      lastRun: job.lastRun,
    }));
  },

  /** Si un job está corriendo ahora mismo (manual o programado). */
  isRunning(jobName) {
    return runningJobs.has(jobName);
  },

  /**
   * Execute a job. `trigger` es "manual" (panel) o "scheduled" (cron) —
   * ambos comparten el mismo lock e idéntica ruta de logging.
   */
  async executeJob(jobName, user = null, trigger = "manual") {
    const job = jobs.get(jobName);
    if (!job) {
      const err = new Error(`Job ${jobName} not found`);
      err.status = 404;
      throw err;
    }

    // Prevent double execution — compartido entre manual y scheduled.
    if (runningJobs.has(jobName)) {
      const err = new Error(`Job ${jobName} is already running`);
      err.status = 409;
      err.code = "ALREADY_RUNNING";
      throw err;
    }

    const executionId = randomUUID();
    runningJobs.add(jobName);

    const startTime = Date.now();
    let logEntry;

    log.info(`Job "${jobName}" iniciado (${trigger})`, { jobName, trigger, executionId });

    try {
      // Execute the job function
      const result = await job.fn();
      const duration = Date.now() - startTime;

      const resultSummary = result && typeof result === "object" ? result : { result };

      logEntry = {
        jobName,
        status: "success",
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        durationMs: duration,
        summary: { ...resultSummary, trigger, executionId },
        errorMessage: null,
      };

      log.info(`Job "${jobName}" completado en ${duration}ms (${trigger})`, {
        jobName,
        trigger,
        executionId,
      });
    } catch (err) {
      const duration = Date.now() - startTime;

      logEntry = {
        jobName,
        status: "failed",
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        durationMs: duration,
        summary: { trigger, executionId },
        errorMessage: sanitizeErrorMessage(err.message),
      };

      log.error(`Job "${jobName}" falló (${trigger})`, { jobName, trigger, executionId, err });
    } finally {
      runningJobs.delete(jobName);
    }

    // Save log to database
    await this.saveLog(logEntry);

    // Update last run timestamp
    const job_ = jobs.get(jobName);
    if (job_) {
      job_.lastRun = new Date();
    }

    return logEntry;
  },

  /**
   * Save log to database
   */
  async saveLog(logEntry) {
    // id generado en la app (UUID v4, crypto.randomUUID) — misma política
    // que el resto de los dominios convertidos. INSERT sin RETURNING +
    // SELECT posterior por id (mysql2 no soporta RETURNING).
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scheduler_logs (
        id, job_name, status, started_at, finished_at, duration_ms, summary, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        logEntry.jobName,
        logEntry.status,
        logEntry.startedAt,
        logEntry.finishedAt || null,
        logEntry.durationMs || null,
        logEntry.summary ? JSON.stringify(logEntry.summary) : null,
        logEntry.errorMessage || null,
      ],
    );
    return id;
  },

  /**
   * Get logs with filtering
   */
  async getLogs(filters = {}) {
    const { jobName, status, page = 1, limit = 50 } = filters;

    const conditions = [];
    const values = [];

    if (jobName) {
      conditions.push(`job_name = ?`);
      values.push(jobName);
    }
    if (status) {
      conditions.push(`status = ?`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM scheduler_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );
    return result.rows;
  },

  /**
   * Get total log count with filtering
   */
  async getLogsCount(filters = {}) {
    const { jobName, status } = filters;

    const conditions = [];
    const values = [];

    if (jobName) {
      conditions.push(`job_name = ?`);
      values.push(jobName);
    }
    if (status) {
      conditions.push(`status = ?`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    // AS total explícito: Postgres nombra "total" a SELECT COUNT(*) as total
    // sin problema (el alias ya estaba puesto), pero se conserva acá tal
    // cual porque ya era portable — sin este alias, MariaDB devolvería
    // "COUNT(*)" literal (mismo hallazgo que otros dominios).
    const result = await pool.query(`SELECT COUNT(*) as total FROM scheduler_logs ${where}`, values);
    return parseInt(result.rows[0]?.total || "0");
  },

  /**
   * Get latest log for a job
   */
  async getLatestLog(jobName) {
    const result = await pool.query(
      `SELECT * FROM scheduler_logs WHERE job_name = ? ORDER BY created_at DESC LIMIT 1`,
      [jobName],
    );
    return result.rows[0] || null;
  },
};
