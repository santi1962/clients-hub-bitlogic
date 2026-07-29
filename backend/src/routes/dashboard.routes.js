import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";
import { adminDashboard, analyticsData } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/admin", authRequired, requireStaff, adminDashboard);
router.get("/analytics", authRequired, requireStaff, analyticsData);

export default router;
