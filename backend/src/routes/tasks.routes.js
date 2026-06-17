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

// Solo staff puede acceder a tareas
router.get("/", requireStaff, listTasks);
router.post("/", requireStaff, createTask);
router.get("/:id", requireStaff, getTask);
router.patch("/:id", requireStaff, updateTask);
router.delete("/:id", requireStaff, deleteTask);
router.post("/:id/complete", requireStaff, completeTask);
router.post("/:id/reopen", requireStaff, reopenTask);

export default router;
