import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin, requireStaff } from "../middlewares/requireRole.js";
import * as ctrl from "../controllers/hosting.controller.js";

const router = Router();

// ── Plans ─────────────────────────────────────────────────────
router.get("/plans", authRequired, requireStaff, ctrl.listPlans);
router.post("/plans", authRequired, requireAdmin, ctrl.createPlan);
router.patch("/plans/:id", authRequired, requireAdmin, ctrl.updatePlan);

// ── Services ──────────────────────────────────────────────────
router.get("/services", authRequired, requireStaff, ctrl.listServices);
router.post("/services", authRequired, requireAdmin, ctrl.createService);
router.get("/services/:id", authRequired, requireStaff, ctrl.getService);
router.patch("/services/:id", authRequired, requireAdmin, ctrl.updateService);
router.post("/services/:id/suspend", authRequired, requireAdmin, ctrl.suspendService);
router.post("/services/:id/reactivate", authRequired, requireAdmin, ctrl.reactivateService);
router.post("/services/:id/change-plan", authRequired, requireAdmin, ctrl.changePlan);
router.post("/services/:id/sync-hestia", authRequired, requireAdmin, ctrl.syncHestia);

export default router;
