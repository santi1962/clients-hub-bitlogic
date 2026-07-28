import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as settingsController from "../controllers/settings.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireSuperAdmin, requireAdmin, requireFinancial } from "../middlewares/requireRole.js";

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

// El permiso por ruta acá refleja quién realmente consume cada endpoint en
// el frontend (src/lib/auth.tsx PERMISSIONS), no un bloqueo uniforme de todo
// /api/settings/* — varias de estas rutas las usan páginas fuera de
// Configuración:
//   - GET /company: además de Configuración (solo super_admin), lo usa
//     Avisos (_admin.avisos.tsx) para el logo del encabezado, y Avisos es
//     de super_admin+admin+finanzas → requireFinancial.
//   - GET/PUT /templates: es la página Plantillas, separada de
//     Configuración, con su propio permiso "plantillas" = super_admin+admin
//     → requireAdmin.
//   - El resto (billing, hosting, payments, email, readiness, escritura de
//     company/logo) es exclusivo de la página Configuración, que en
//     PERMISSIONS solo tiene super_admin → requireSuperAdmin.

// Company
router.get("/company", authRequired, requireFinancial, settingsController.getCompanySettings);
router.put("/company", authRequired, requireSuperAdmin, settingsController.updateCompanySettings);
router.post("/company/logo", authRequired, requireSuperAdmin, uploadLogo.single("logo"), settingsController.uploadCompanyLogo);
// Sin auth a propósito: sirve la imagen del logo para <img src> (el browser
// no manda el Authorization header en esos requests). No es parte del
// hallazgo de autorización — es un recurso público de solo lectura.
router.get("/company/logo/:filename", settingsController.serveCompanyLogo);

// Billing/Facturación (solo Configuración)
router.get("/billing", authRequired, requireSuperAdmin, settingsController.getBillingSettings);
router.put("/billing", authRequired, requireSuperAdmin, settingsController.updateBillingSettings);

// Hosting/Hestia (solo Configuración)
router.get("/hosting", authRequired, requireSuperAdmin, settingsController.getHostingSettings);
router.put("/hosting", authRequired, requireSuperAdmin, settingsController.updateHostingSettings);

// Payments/Pagos (solo Configuración)
router.get("/payments", authRequired, requireSuperAdmin, settingsController.getPaymentSettings);
router.put("/payments", authRequired, requireSuperAdmin, settingsController.updatePaymentSettings);

// Email/SMTP — solo lectura, se edita en backend/.env (solo Configuración)
router.get("/email", authRequired, requireSuperAdmin, settingsController.getEmailSettings);

// Readiness (solo Configuración; no tiene otro consumidor en el frontend hoy)
router.get("/readiness", authRequired, requireSuperAdmin, settingsController.getReadinessStatus);

// Email Templates — página "Plantillas", independiente de Configuración
router.get("/templates", authRequired, requireAdmin, settingsController.getEmailTemplates);
router.put("/templates/:id", authRequired, requireAdmin, settingsController.updateEmailTemplate);

export default router;
