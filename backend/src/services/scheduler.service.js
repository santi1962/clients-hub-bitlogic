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
    const query = `
      INSERT INTO scheduler_logs (
        job_name, status, started_at, finished_at, duration_ms, summary, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      RETURNING id
    `;

    const values = [
      logEntry.jobName,
      logEntry.status,
      logEntry.startedAt,
      logEntry.finishedAt || null,
      logEntry.durationMs || null,
      logEntry.summary ? JSON.stringify(logEntry.summary) : null,
      logEntry.errorMessage || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0]?.id;
  },

  /**
   * Get logs with filtering
   */
  async getLogs(filters = {}) {
    const { jobName, status, page = 1, limit = 50 } = filters;

    let query = "SELECT * FROM scheduler_logs WHERE 1=1";
    const values = [];
    let paramCount = 1;

    if (jobName) {
      query += ` AND job_name = $${paramCount++}`;
      values.push(jobName);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      values.push(status);
    }

    query += " ORDER BY created_at DESC";

    // Pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Get total log count with filtering
   */
  async getLogsCount(filters = {}) {
    const { jobName, status } = filters;

    let query = "SELECT COUNT(*) as total FROM scheduler_logs WHERE 1=1";
    const values = [];
    let paramCount = 1;

    if (jobName) {
      query += ` AND job_name = $${paramCount++}`;
      values.push(jobName);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      values.push(status);
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0]?.total || "0");
  },

  /**
   * Get latest log for a job
   */
  async getLatestLog(jobName) {
    const query = `
      SELECT * FROM scheduler_logs
      WHERE job_name = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Bug objetivo corregido: usaba `db.query` pero `db` nunca estaba
    // importado en este archivo — tiraba ReferenceError siempre que se
    // llamaba (GET /api/scheduler/jobs/:jobName/latest estaba roto).
    const result = await pool.query(query, [jobName]);
    return result.rows[0] || null;
  },
};
