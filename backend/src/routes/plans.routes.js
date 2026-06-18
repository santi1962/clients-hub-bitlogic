import express from "express";
import * as plansController from "../controllers/plans.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// GET /api/hosting/plans
router.get("/", plansController.list);

// GET /api/hosting/plans/:id
router.get("/:id", plansController.get);

// POST /api/hosting/plans
router.post("/", requireAuth, plansController.create);

// PATCH /api/hosting/plans/:id
router.patch("/:id", requireAuth, plansController.update);

// DELETE /api/hosting/plans/:id
router.delete("/:id", requireAuth, plansController.remove);

export default router;
