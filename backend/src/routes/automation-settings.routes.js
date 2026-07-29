/**
 * Automation Settings Routes
 * Admin only
 */
import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import {
  getAllSettings,
  getSetting,
  updateSetting,
  toggleSetting,
  getReminderSettings,
  addNotificationRecipient,
  removeNotificationRecipient,
} from "../controllers/automation-settings.controller.js";

const router = Router();

// All routes require admin
router.use(authRequired, requireAdmin);

// Get all settings
router.get("/", getAllSettings);

// Get all reminder settings
router.get("/reminders", getReminderSettings);

// Get specific setting
router.get("/:key", getSetting);

// Update specific setting
router.patch("/:key", updateSetting);

// Toggle setting enabled/disabled
router.post("/:key/toggle", toggleSetting);

// Notification recipients management
router.post("/:type/recipients", addNotificationRecipient);
router.delete("/:type/recipients", removeNotificationRecipient);

export default router;
