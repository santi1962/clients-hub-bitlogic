import { verifyAccessToken } from "../utils/jwt.js";
import pool from "../db/pool.js";

/**
 * Verifica el JWT y enriquece req.user con datos frescos de la base (id, name,
 * role, clientId, status). El JWT solo lleva { sub, role, clientId } — sin esto,
 * cualquier código que loguee auditoría con user.name/user.id (la mayoría de los
 * controllers) siempre ve "System"/null, porque esos campos nunca estuvieron en
 * el token. De paso, esto también hace que desactivar un usuario lo saque de
 * inmediato en vez de esperar a que expire el access token (hasta 15 min).
 */
export async function authRequired(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Token requerido" } });
  }

  try {
    const payload = verifyAccessToken(auth.slice(7));

    const { rows } = await pool.query(
      `SELECT id, name, role, status, client_id FROM users WHERE id = ?`,
      [payload.sub],
    );
    const dbUser = rows[0];

    if (!dbUser || dbUser.status !== "active") {
      return res.status(401).json({ error: { message: "Usuario inactivo o inexistente" } });
    }

    req.user = {
      sub: dbUser.id,
      id: dbUser.id,
      name: dbUser.name,
      role: dbUser.role,
      clientId: dbUser.client_id,
    };
    next();
  } catch {
    res.status(401).json({ error: { message: "Token inválido o expirado" } });
  }
}
