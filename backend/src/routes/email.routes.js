/**
 * Email Routes
 */
import express from "express";
import { testEmail, listLogs } from "../controllers/email.controller.js";
import { authRequired } from "../middlewares/authRequired.js";

const router = express.Router();

const adminOnly = (req, res, next) => {
  const isAdmin = req.user?.role === "super_admin" || req.user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).json({ error: "Only admins can access this" });
  }
  next();
};

// Solo super_admin y admin
router.post("/test", authRequired, adminOnly, testEmail);
router.get("/logs", authRequired, adminOnly, listLogs);

export default router;
