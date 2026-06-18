import jwt from "jsonwebtoken";
import config from "../config/index.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "NO_AUTH", message: "Token requerido" },
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" },
    });
  }
}
