import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { debugConfig, testStatus, listUsers, getUser } from "../controllers/hestia.controller.js";

const router = Router();

// Debug endpoint - admin only, no password exposed
router.get("/debug-config", authRequired, requireAdmin, debugConfig);

// Solo admin y super_admin
router.get("/status", authRequired, requireAdmin, testStatus);
router.get("/users", authRequired, requireAdmin, listUsers);
router.get("/users/:username", authRequired, requireAdmin, getUser);

export default router;
