import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as settingsController from "../controllers/settings.controller.js";
import { authRequired } from "../middlewares/authRequired.js";

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
router.get("/company", authRequired, settingsController.getCompanySettings);
router.put("/company", authRequired, settingsController.updateCompanySettings);
router.post("/company/logo", authRequired, uploadLogo.single("logo"), settingsController.uploadCompanyLogo);
router.get("/company/logo/:filename", settingsController.serveCompanyLogo);

// Billing/Facturación
router.get("/billing", authRequired, settingsController.getBillingSettings);
router.put("/billing", authRequired, settingsController.updateBillingSettings);

// Hosting/Hestia
router.get("/hosting", authRequired, settingsController.getHostingSettings);
router.put("/hosting", authRequired, settingsController.updateHostingSettings);

// Payments/Pagos
router.get("/payments", authRequired, settingsController.getPaymentSettings);
router.put("/payments", authRequired, settingsController.updatePaymentSettings);

// Email/SMTP (solo lectura — se edita en backend/.env, ver getEmailSettings)
router.get("/email", authRequired, settingsController.getEmailSettings);

// Readiness
router.get("/readiness", authRequired, settingsController.getReadinessStatus);

// Email Templates
router.get("/templates", authRequired, settingsController.getEmailTemplates);
router.put("/templates/:id", authRequired, settingsController.updateEmailTemplate);

export default router;
