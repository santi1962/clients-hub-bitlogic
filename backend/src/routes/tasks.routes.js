/**
 * Internal Tasks Routes
 */
import express from "express";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
} from "../controllers/tasks.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";

const router = express.Router();

router.get("/", authRequired, requireStaff, listTasks);
router.post("/", authRequired, requireStaff, createTask);
router.get("/:id", authRequired, requireStaff, getTask);
router.patch("/:id", authRequired, requireStaff, updateTask);
router.delete("/:id", authRequired, requireStaff, deleteTask);
router.post("/:id/complete", authRequired, requireStaff, completeTask);
router.post("/:id/reopen", authRequired, requireStaff, reopenTask);

export default router;
