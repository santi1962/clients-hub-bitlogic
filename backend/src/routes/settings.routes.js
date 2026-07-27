import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as settingsController from "../controllers/settings.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logosDir = path.join(__dirname, "../../uploads/logos");
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes"));
    }
    cb(null, true);
  },
});

const router = express.Router();

// Company
router.get("/company", requireAuth, settingsController.getCompanySettings);
router.put("/company", requireAuth, settingsController.updateCompanySettings);
router.post("/company/logo", requireAuth, uploadLogo.single("logo"), settingsController.uploadCompanyLogo);
router.get("/company/logo/:filename", settingsController.serveCompanyLogo);

// Billing/Facturación
router.get("/billing", requireAuth, settingsController.getBillingSettings);
router.put("/billing", requireAuth, settingsController.updateBillingSettings);

// Hosting/Hestia
router.get("/hosting", requireAuth, settingsController.getHostingSettings);
router.put("/hosting", requireAuth, settingsController.updateHostingSettings);

// Payments/Pagos
router.get("/payments", requireAuth, settingsController.getPaymentSettings);
router.put("/payments", requireAuth, settingsController.updatePaymentSettings);

// Email/SMTP (solo lectura — se edita en backend/.env, ver getEmailSettings)
router.get("/email", requireAuth, settingsController.getEmailSettings);

// Readiness
router.get("/readiness", requireAuth, settingsController.getReadinessStatus);

// Email Templates
router.get("/templates", requireAuth, settingsController.getEmailTemplates);
router.put("/templates/:id", requireAuth, settingsController.updateEmailTemplate);

export default router;
