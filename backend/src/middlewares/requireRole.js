import { createLogger } from "../utils/logger.js";

const log = createLogger("require-role");

/**
 * Middleware de control de acceso por rol.
 *
 * Uso:
 *   router.get('/...', authRequired, requireStaff, handler)
 *   router.post('/...', authRequired, requireAdmin, handler)
 *
 * Siempre se usa DESPUÉS de authRequired (que ya autentica y carga
 * req.user fresco desde la base) — este middleware no reemplaza esa
 * autenticación, solo agrega la verificación de rol sobre un req.user
 * que ya se asume válido.
 */

/** Requiere que req.user.role esté en la lista de roles permitidos. */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Defensivo: en la práctica authRequired ya devolvió 401 antes de
    // llegar acá si no había usuario autenticado.
    if (!req.user) {
      return res.status(401).json({ error: { message: "No autenticado" }, requestId: req.requestId });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Se registra el intento denegado (rol, ruta, quién) para auditar
      // accesos indebidos — nunca el token ni ningún header de Authorization.
      log.warn(`Acceso denegado: rol "${req.user.role}" intentó ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        userId: req.user.id,
        role: req.user.role,
        allowedRoles,
      });
      return res.status(403).json({
        error: { message: "Acceso denegado: permiso insuficiente" },
        requestId: req.requestId,
      });
    }

    next();
  };
}

/** Solo super admin. */
export const requireSuperAdmin = requireRole("super_admin");

/** Super admin + admin: pueden leer y escribir todo. */
export const requireAdmin = requireRole("super_admin", "admin");

/** Super admin + admin + finanzas: pueden escribir en billing. */
export const requireFinancial = requireRole("super_admin", "admin", "finanzas");

/** Cualquier staff (admin + soporte + finanzas): lectura. Clientes bloqueados. */
export const requireStaff = requireRole("super_admin", "admin", "soporte", "finanzas");
