import express from "express";
import * as settingsController from "../controllers/settings.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = express.Router();

// Company
router.get("/company", requireAuth, settingsController.getCompanySettings);
router.put("/company", requireAuth, settingsController.updateCompanySettings);

// Billing/Facturación
router.get("/billing", requireAuth, settingsController.getBillingSettings);
router.put("/billing", requireAuth, settingsController.updateBillingSettings);

// Hosting/Hestia
router.get("/hosting", requireAuth, settingsController.getHostingSettings);
router.put("/hosting", requireAuth, settingsController.updateHostingSettings);

// Payments/Pagos
router.get("/payments", requireAuth, settingsController.getPaymentSettings);
router.put("/payments", requireAuth, settingsController.updatePaymentSettings);

// Email/SMTP
router.get("/email", requireAuth, settingsController.getEmailSettings);
router.put("/email", requireAuth, settingsController.updateEmailSettings);

// WhatsApp
router.get("/whatsapp", requireAuth, settingsController.getWhatsappSettings);
router.put("/whatsapp", requireAuth, settingsController.updateWhatsappSettings);

// Readiness
router.get("/readiness", requireAuth, settingsController.getReadinessStatus);

export default router;
