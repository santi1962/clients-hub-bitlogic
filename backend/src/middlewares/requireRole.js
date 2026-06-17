/**
 * Middleware de control de acceso por rol.
 *
 * Uso:
 *   router.get('/...', authRequired, requireStaff, handler)
 *   router.post('/...', authRequired, requireAdmin, handler)
 */

/** Requiere que req.user.role esté en la lista de roles permitidos. */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: "No autenticado" } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: "Acceso denegado: permiso insuficiente" } });
    }
    next();
  };
}

/** Super admin + admin: pueden leer y escribir todo. */
export const requireAdmin = requireRole("super_admin", "admin");

/** Super admin + admin + finanzas: pueden escribir en billing. */
export const requireFinancial = requireRole("super_admin", "admin", "finanzas");

/** Cualquier staff (admin + soporte + finanzas): lectura. Clientes bloqueados. */
export const requireStaff = requireRole("super_admin", "admin", "soporte", "finanzas");
