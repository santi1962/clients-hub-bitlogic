import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";
import { adminDashboard } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/admin", authRequired, requireStaff, adminDashboard);

export default router;
