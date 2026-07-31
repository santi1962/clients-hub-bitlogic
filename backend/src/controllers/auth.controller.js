import * as authService from "../services/auth.service.js";
import { emailService } from "../services/email.service.js";
import config from "../config/index.js";

const REFRESH_COOKIE = "refresh_token";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refreshCookieOpts(expires) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: config.nodeEnv === "production" ? "strict" : "lax",
    expires,
    path: "/api/auth",
  };
}

/**
 * SSO con Bitiando: el staff no tiene login propio en el hub, se loguea una
 * sola vez en Bitiando y esa sesión (cookie `bitiando_session`, compartida
 * entre subdominios de *.bitlogic.com.ar) alcanza para entrar acá también.
 *
 * No confiamos en un JWT compartido: le preguntamos directamente a Bitiando
 * "¿quién es este cookie?" vía su propio /api/auth/me, y recién con esa
 * respuesta emitimos los tokens normales del hub (mismo flujo que un login
 * con contraseña, sin la contraseña).
 */
export async function sso(req, res, next) {
  try {
    const bitiandoToken = req.cookies?.[config.bitiando.sessionCookie];
    if (!bitiandoToken) {
      return res.status(401).json({ error: { message: "No hay sesión de Bitiando" } });
    }

    let bitiandoUser;
    try {
      const resp = await fetch(`${config.bitiando.apiUrl}/api/auth/me`, {
        headers: { Cookie: `${config.bitiando.sessionCookie}=${bitiandoToken}` },
      });
      if (!resp.ok) {
        return res.status(401).json({ error: { message: "Sesión de Bitiando inválida o expirada" } });
      }
      bitiandoUser = await resp.json();
    } catch {
      return res.status(502).json({ error: { message: "No se pudo validar la sesión con Bitiando" } });
    }

    if (!bitiandoUser?.email) {
      return res.status(401).json({ error: { message: "Respuesta de Bitiando sin email" } });
    }

    const { accessToken, refreshToken, refreshExpiry, user } = await authService.ssoLogin(
      bitiandoUser.email,
    );

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts(refreshExpiry));
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
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

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: { message: "El email es requerido" } });

    const result = await authService.forgotPassword(email);

    // Si existe el usuario, enviar email (en background, no bloquear respuesta)
    if (result) {
      const resetUrl = `${config.frontendUrl ?? "http://localhost:5173"}/reset-password?token=${result.rawToken}`;
      emailService.sendEmail({
        to: email,
        subject: "Recuperar contraseña — Bitlogic",
        html: `
          <p>Hola,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p><a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Restablecer contraseña</a></p>
          <p>El enlace expira en 15 minutos. Si no solicitaste esto, ignorá este email.</p>
          <p>Bitlogic</p>
        `,
      }).catch((err) => console.error("[forgot-password] email error:", err.message));
    }

    // Siempre 200 para no revelar si el email existe
    res.json({ message: "Si el email está registrado, recibirás las instrucciones en breve." });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body ?? {};
    if (!token || !password) {
      return res.status(400).json({ error: { message: "token y password son requeridos" } });
    }
    await authService.resetPassword(token, password);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { name, phone, notifications } = req.body ?? {};
    const updated = await authService.updateProfile(req.user.sub, { name, phone, notifications });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body ?? {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: { message: "oldPassword y newPassword son requeridos" } });
    }
    await authService.changePassword(req.user.sub, oldPassword, newPassword);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
