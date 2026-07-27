/**
 * Scheduler Controller
 * Handles job registration, execution, and log retrieval
 */
import { schedulerService } from "../services/scheduler.service.js";

export async function listJobs(req, res, next) {
  try {
    const jobs = schedulerService.getJobs();
    res.json({ data: jobs, meta: { total: jobs.length } });
  } catch (err) {
    next(err);
  }
}

export async function getLogs(req, res, next) {
  try {
    const { jobName, status, page = "1", limit = "50" } = req.query;

    const filters = {
      jobName: jobName || undefined,
      status: status || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(200, parseInt(limit) || 50),
    };

    const logs = await schedulerService.getLogs(filters);
    const total = await schedulerService.getLogsCount({
      jobName: jobName || undefined,
      status: status || undefined,
    });

    res.json({
      data: logs,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function runJob(req, res, next) {
  try {
    const { jobName } = req.params;

    if (!jobName) {
      return res.status(400).json({ error: { message: "jobName required" } });
    }

    const log = await schedulerService.executeJob(jobName, req.user);

    res.json({
      jobName,
      log,
      message: `Job ${jobName} executed`,
    });
  } catch (err) {
    next(err);
  }
}

export async function getJobLatest(req, res, next) {
  try {
    const { jobName } = req.params;

    const log = await schedulerService.getLatestLog(jobName);

    if (!log) {
      return res.status(404).json({ error: { message: "No logs found for this job" } });
    }

    res.json({ data: log });
  } catch (err) {
    next(err);
  }
}
