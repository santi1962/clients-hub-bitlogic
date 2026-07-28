import express from "express";
import * as plansController from "../controllers/plans.controller.js";
import { authRequired } from "../middlewares/authRequired.js";

const router = express.Router();

// GET /api/hosting/plans
router.get("/", plansController.list);

// GET /api/hosting/plans/:id
router.get("/:id", plansController.get);

// POST /api/hosting/plans
router.post("/", authRequired, plansController.create);

// PATCH /api/hosting/plans/:id
router.patch("/:id", authRequired, plansController.update);

// DELETE /api/hosting/plans/:id
router.delete("/:id", authRequired, plansController.remove);

export default router;
