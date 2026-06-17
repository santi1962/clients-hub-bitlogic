import { verifyAccessToken } from "../utils/jwt.js";

export function authRequired(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Token requerido" } });
  }

  try {
    const payload = verifyAccessToken(auth.slice(7));
    req.user = payload; // { sub: userId, role, iat, exp }
    next();
  } catch {
    res.status(401).json({ error: { message: "Token inválido o expirado" } });
  }
}
