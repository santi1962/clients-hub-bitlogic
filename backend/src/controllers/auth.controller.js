import * as authService from "../services/auth.service.js";
import config from "../config/index.js";

const REFRESH_COOKIE = "refresh_token";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refreshCookieOpts(expires) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production", // solo HTTPS en prod
    sameSite: "lax", // lax funciona cross-port en localhost
    expires,
    path: "/api/auth", // scope mínimo: solo rutas de auth
  };
}

export async function login(req, res, next) {
  try {
    const { email, password, remember } = req.body ?? {};

    // ── Validaciones básicas ─────────────────────────────────
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: { message: "El email es requerido" } });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: { message: "El email no es válido" } });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: { message: "La contraseña es requerida" } });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: { message: "La contraseña debe tener al menos 6 caracteres" } });
    }
    // ─────────────────────────────────────────────────────────

    const { accessToken, refreshToken, refreshExpiry, user } = await authService.login(
      normalizedEmail,
      password,
      Boolean(remember),
    );

    // httpOnly: el frontend nunca puede leer esta cookie via JS (protección XSS)
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts(refreshExpiry));

    // El accessToken viaja en el body (el frontend lo guarda en memoria)
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(refreshToken);
    // Limpiar cookie incluso si el token ya estaba revocado
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      return res.status(401).json({ error: { message: "Sin sesión activa" } });
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.sub);
    res.json(user);
  } catch (err) {
    next(err);
  }
}
