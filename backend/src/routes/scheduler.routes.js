/**
 * Scheduler Routes
 * Admin only - manual execution and log retrieval
 */
import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import {
  listJobs,
  getLogs,
  runJob,
  getJobLatest,
} from "../controllers/scheduler.controller.js";

const router = Router();

// All routes require admin authentication
router.use(authRequired, requireAdmin);

// Get all registered jobs
router.get("/jobs", listJobs);

// Get job execution logs
router.get("/logs", getLogs);

// Get latest log for a specific job
router.get("/jobs/:jobName/latest", getJobLatest);

// Manually execute a job
router.post("/jobs/:jobName/run", runJob);

export default router;
