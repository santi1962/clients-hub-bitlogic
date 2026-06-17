/**
 * Scheduler Service
 * Manages job registration, execution, and logging
 * Phase 4E.1: Infrastructure only (no critical actions yet)
 */
import pool from "../db/pool.js";

// In-memory job registry
const jobs = new Map();
const runningJobs = new Set();

export const schedulerService = {
  /**
   * Register a job
   */
  registerJob(jobName, description, jobFn) {
    jobs.set(jobName, {
      name: jobName,
      description,
      fn: jobFn,
      lastRun: null,
    });
    console.log(`[Scheduler] Registered job: ${jobName}`);
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

  /**
   * Execute a job manually
   */
  async executeJob(jobName, user = null) {
    // Prevent double execution
    if (runningJobs.has(jobName)) {
      throw new Error(`Job ${jobName} is already running`);
    }

    const job = jobs.get(jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    const jobId = Date.now(); // Simple unique ID per execution
    runningJobs.add(jobName);

    const startTime = Date.now();
    let logEntry = {
      jobName,
      status: "running",
      startedAt: new Date(),
      summary: null,
      errorMessage: null,
    };

    try {
      console.log(`[Scheduler] Starting job: ${jobName}`);

      // Execute the job function
      const result = await job.fn();

      const duration = Date.now() - startTime;

      logEntry = {
        jobName,
        status: "success",
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        durationMs: duration,
        summary: result,
        errorMessage: null,
      };

      console.log(`[Scheduler] Job ${jobName} completed in ${duration}ms`);
    } catch (err) {
      const duration = Date.now() - startTime;

      logEntry = {
        jobName,
        status: "failed",
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        durationMs: duration,
        summary: null,
        errorMessage: err.message,
      };

      console.error(`[Scheduler] Job ${jobName} failed: ${err.message}`);
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

    const result = await db.query(query, [jobName]);
    return result.rows[0] || null;
  },
};
