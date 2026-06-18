import pool from "../db/pool.js";
import { auditService } from "../services/audit.service.js";
import * as settingsService from "../services/settings.service.js";

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
