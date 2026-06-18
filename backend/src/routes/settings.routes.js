import express from "express";
import * as settingsController from "../controllers/settings.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// GET /api/settings/company
router.get("/company", requireAuth, settingsController.getCompanySettings);

// PUT /api/settings/company
router.put("/company", requireAuth, settingsController.updateCompanySettings);

// GET /api/settings/readiness
router.get("/readiness", requireAuth, settingsController.getReadinessStatus);

export default router;
