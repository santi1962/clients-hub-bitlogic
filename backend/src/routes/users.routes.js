import express from "express";
import {
  listPortalUsers,
  createPortalUser,
  resetPassword,
  deletePortalUser,
} from "../controllers/users.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";

const router = express.Router();

router.get("/portal", authRequired, requireStaff, listPortalUsers);
router.post("/portal", authRequired, requireStaff, createPortalUser);
router.post("/:id/reset-password", authRequired, requireStaff, resetPassword);
router.delete("/:id", authRequired, requireStaff, deletePortalUser);

export default router;
