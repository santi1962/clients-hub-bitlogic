import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { listLogs, getLog } from "../controllers/audit.controller.js";

const router = Router();

// Solo admin y super_admin
router.get("/", authRequired, requireAdmin, listLogs);
router.get("/:id", authRequired, requireAdmin, getLog);

export default router;
