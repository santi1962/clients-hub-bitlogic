import pool from "../db/pool.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { auditService } from "../services/audit.service.js";
import * as settingsService from "../services/settings.service.js";
import config from "../config/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLACEHOLDER_KEYWORDS = ["demo", "test", "fake", "placeholder", "example", "sample"];

function containsPlaceholder(value) {
  if (!value || typeof value !== "string") return false;
  return PLACEHOLDER_KEYWORDS.some((keyword) =>
    value.toLowerCase().includes(keyword),
  );
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * GET /api/settings/company
 * Obtiene la configuración de empresa
 */
export async function getCompanySettings(req, res, next) {
  try {
    const settings = await settingsService.getCompanySettings();
    res.json(settings || {});
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/settings/company
 * Actualiza/crea la configuración de empresa
 * Body: { companyName, contactEmail, phone, taxId, address, currency }
 */
export async function updateCompanySettings(req, res, next) {
  try {
    const { companyName, contactEmail, phone, taxId, address, currency } = req.body;

    // Validaciones
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        error: { code: "INVALID_COMPANY_NAME", message: "El nombre de la empresa es requerido" },
      });
    }

    if (containsPlaceholder(companyName)) {
      return res.status(400).json({
        error: {
          code: "PLACEHOLDER_DETECTED",
          message: "No se permiten datos de ejemplo o placeholder",
        },
      });
    }

    if (contactEmail && !isValidEmail(contactEmail)) {
      return res.status(400).json({
        error: { code: "INVALID_EMAIL", message: "El email de contacto no es válido" },
      });
    }

    if (contactEmail && containsPlaceholder(contactEmail)) {
      return res.status(400).json({
        error: {
          code: "PLACEHOLDER_DETECTED",
          message: "No se permiten emails de ejemplo",
        },
      });
    }

    const settings = await settingsService.updateCompanySettings({
      companyName: companyName.trim(),
      contactEmail: contactEmail?.trim() || null,
      phone: phone?.trim() || null,
      taxId: taxId?.trim() || null,
      address: address?.trim() || null,
      currency: currency || "ARS",
    });

    await auditService.logAction({
      user: req.user,
      requestId: req.requestId,
      action: "editar",
      entityType: "configuracion",
      entityId: "empresa",
      entityName: "Configuración de empresa",
      newValues: req.body,
    });

    res.json(settings);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/settings/billing
 * Obtiene la configuración de facturación
 */
export async function getBillingSettings(req, res) {
  res.json({
    currency: "ARS",
    defaultPaymentDays: 10,
    invoicePrefix: "AV-2026-",
    nextInvoiceNumber: 148,
    invoiceLegalText: "Este aviso no constituye factura. La factura electrónica será emitida una vez acreditado el pago.",
    bankData: "Banco Galicia\nCBU: 0070123456789012345678\nAlias: BITLOGIC.HOSTING\nTitular: Bitlogic S.R.L.",
  });
}

/**
 * PUT /api/settings/billing
 * Actualiza la configuración de facturación
 */
export async function updateBillingSettings(req, res) {
  // Guardaría en base de datos
  res.json({
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * GET /api/settings/hosting
 * Obtiene la configuración de hosting
 */
export async function getHostingSettings(req, res) {
  res.json({
    hestiaUrl: "https://srv01.bitlogic.com.ar:8083",
    mainServer: "srv01.bitlogic.com.ar",
    serverIp: "200.45.12.34",
    defaultQuotaGb: 5,
    defaultEmails: 10,
    spaceAlertsEnabled: true,
  });
}

/**
 * PUT /api/settings/hosting
 * Actualiza la configuración de hosting
 */
export async function updateHostingSettings(req, res) {
  res.json({
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * GET /api/settings/payments
 * Obtiene la configuración de métodos de pago
 */
export async function getPaymentSettings(req, res) {
  res.json({
    mercadoPagoEnabled: false,
    paypalEnabled: false,
    bankTransferEnabled: true,
    manualPaymentEnabled: true,
  });
}

/**
 * PUT /api/settings/payments
 * Actualiza la configuración de pagos
 */
export async function updatePaymentSettings(req, res) {
  res.json({
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * GET /api/settings/email
 * Devuelve la configuración SMTP REAL (leída de backend/.env), solo lectura.
 * No existe un PUT: el SMTP se configura editando .env y reiniciando el server,
 * igual que el resto de los secretos de la app (JWT, DB, Hestia, MercadoPago).
 */
export async function getEmailSettings(req, res) {
  res.json({
    smtpHost: config.smtp.host || "",
    smtpPort: config.smtp.port,
    smtpUser: config.smtp.user || "",
    smtpConfigured: !!(config.smtp.host && config.smtp.user && config.smtp.pass),
    fromName: config.smtp.fromName,
    fromEmail: config.smtp.fromEmail,
    editableNote: "Se edita en backend/.env (SMTP_HOST, SMTP_USER, SMTP_PASS) y requiere reiniciar el servidor.",
  });
}

/**
 * GET /api/settings/readiness
 * Verifica si el sistema está listo para producción
 */
export async function getReadinessStatus(req, res, next) {
  try {
    const checks = {
      companyConfigured: false,
      activePlansExist: false,
      realClientsExist: false,
      realServicesExist: false,
      domainsExist: false,
      portalUsersExist: false,
      smtpConfigured: false,
      hestiaConfigured: false,
    };

    // 1. Verificar que la empresa esté configurada
    const companyRes = await pool.query("SELECT COUNT(*) as cnt FROM company_settings");
    checks.companyConfigured = parseInt(companyRes.rows[0].cnt) > 0;

    // 2. Verificar que hay planes activos
    const plansRes = await pool.query(
      "SELECT COUNT(*) as cnt FROM hosting_plans WHERE status = 'active'",
    );
    checks.activePlansExist = parseInt(plansRes.rows[0].cnt) > 0;

    // 3. Verificar que hay clientes activos
    const clientsRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM clients WHERE status = 'active'`,
    );
    checks.realClientsExist = parseInt(clientsRes.rows[0].cnt) > 0;

    // 4. Verificar que hay servicios activos
    const servicesRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM hosting_services WHERE status = 'active'`,
    );
    checks.realServicesExist = parseInt(servicesRes.rows[0].cnt) > 0;

    // 5. Verificar que hay dominios
    const domainsRes = await pool.query(`SELECT COUNT(*) as cnt FROM domains WHERE status = 'active'`);
    checks.domainsExist = parseInt(domainsRes.rows[0].cnt) > 0;

    // 6. Verificar que hay usuarios portal cliente
    const usersRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM users WHERE role = 'cliente' AND status = 'active'`,
    );
    checks.portalUsersExist = parseInt(usersRes.rows[0].cnt) > 0;

    // 7. SMTP configurado
    checks.smtpConfigured = !!(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );

    // 8. Hestia configurado
    checks.hestiaConfigured = !!(
      process.env.HESTIA_API_URL && process.env.HESTIA_API_KEY
    );

    const completed = Object.values(checks).filter((v) => v).length;
    const total = Object.keys(checks).length;
    const percentage = Math.round((completed / total) * 100);

    const ready = Object.values(checks).every((v) => v);

    res.json({
      ready,
      checks,
      completed,
      total,
      percentage,
      readyForProduction: ready,
      warnings: !ready
        ? Object.entries(checks)
            .filter(([_, v]) => !v)
            .map(([k]) => k)
        : [],
    });
  } catch (err) {
    next(err);
  }
}

export async function getEmailTemplates(req, res, next) {
  try {
    const { rows } = await pool.query("SELECT id, subject, body FROM email_templates ORDER BY id");
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function updateEmailTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { subject, body } = req.body ?? {};
    if (!subject || !body) {
      return res.status(400).json({ error: { message: "subject y body son requeridos" } });
    }
    await pool.query(
      `INSERT INTO email_templates (id, subject, body, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET subject = $2, body = $3, updated_at = now()`,
      [id, subject, body],
    );
    res.json({ id, subject, body });
  } catch (err) {
    next(err);
  }
}

export async function uploadCompanyLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "No se recibió ningún archivo" } });
    }
    const logoUrl = `/api/settings/company/logo/${req.file.filename}`;
    await settingsService.updateCompanyLogo(logoUrl);
    res.json({ logoUrl });
  } catch (err) {
    next(err);
  }
}

export async function serveCompanyLogo(req, res, next) {
  try {
    const { filename } = req.params;
    const safe = path.basename(filename);
    if (safe !== filename || filename.includes("..")) {
      return res.status(400).json({ error: { message: "Nombre de archivo inválido" } });
    }
    const filePath = path.join(__dirname, "../../uploads/logos", safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: "Logo no encontrado" } });
    }
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}
