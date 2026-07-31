import { randomBytes, createHash, randomUUID } from "crypto";
import pool from "../db/pool.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import config from "../config/index.js";

function formatUser(row) {
  const defaultNotifications = { emailPayments: true, emailTickets: true, whatsapp: false, weeklyReport: true };
  // `pg` devuelve la columna JSON de Postgres ya parseada como objeto; el
  // tipo JSON de MariaDB es un alias de LONGTEXT (no tiene tipo binario
  // propio) y el driver devuelve el string crudo — se normaliza acá, en el
  // único lugar donde se expone `notifications` en una respuesta.
  let notifications = row.notifications ?? defaultNotifications;
  if (typeof notifications === "string") {
    notifications = JSON.parse(notifications);
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? null,
    clientId: row.client_id ?? null,
    lastLoginAt: row.last_login_at ?? null,
    notifications,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function findActiveUserByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = ? AND status = 'active'`, [
    email.toLowerCase().trim(),
  ]);
  return rows[0] ?? null;
}

async function issueRefreshToken(userId, remember) {
  const rawToken = randomBytes(64).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();

  if (remember) {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setDate(expiresAt.getDate() + 1);
  }

  // id generado en la app (UUID v4, crypto.randomUUID) — política definitiva
  // de la Fase DB-3A, ya era el patrón usado acá desde antes de esta fase.
  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), userId, tokenHash, expiresAt],
  );

  return { rawToken, expiresAt };
}

export async function login(email, password, remember = false) {
  const user = await findActiveUserByEmail(email);

  // Respuesta idéntica para email inexistente o contraseña incorrecta (anti-enumeration)
  const invalid = () => {
    const err = new Error("Credenciales inválidas");
    err.status = 401;
    return err;
  };

  if (!user) throw invalid();

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw invalid();

  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = ?`, [user.id]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role, clientId: user.client_id ?? null });
  const { rawToken: refreshToken, expiresAt: refreshExpiry } = await issueRefreshToken(
    user.id,
    remember,
  );

  return { accessToken, refreshToken, refreshExpiry, user: formatUser(user) };
}

/**
 * Login vía SSO de Bitiando: la identidad ya fue verificada por Bitiando
 * (el controller llamó a su /api/auth/me con la cookie de sesión) — acá NO
 * se verifica contraseña, solo se busca el usuario del hub por email y se
 * emiten los mismos tokens que emitiría un login normal. Si el email no
 * tiene una cuenta activa en el hub, no se auto-crea: el staff de Bitiando
 * que no debe tener acceso al hub (o al que no se le dio de alta acá) queda
 * afuera explícitamente.
 */
export async function ssoLogin(email) {
  const user = await findActiveUserByEmail(email);

  if (!user) {
    const err = new Error("Tu cuenta no tiene acceso al panel de Bitlogic Hub");
    err.status = 403;
    throw err;
  }

  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = ?`, [user.id]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role, clientId: user.client_id ?? null });
  const { rawToken: refreshToken, expiresAt: refreshExpiry } = await issueRefreshToken(user.id, true);

  return { accessToken, refreshToken, refreshExpiry, user: formatUser(user) };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  );
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    const err = new Error("Sin token de refresco");
    err.status = 401;
    throw err;
  }

  const tokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `SELECT rt.user_id, u.role, u.status, u.client_id
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = ?
       AND rt.revoked_at IS NULL
       AND rt.expires_at > now()`,
    [tokenHash],
  );

  const rt = rows[0];
  if (!rt) {
    const err = new Error("Token de refresco inválido o expirado");
    err.status = 401;
    throw err;
  }

  if (rt.status !== "active") {
    const err = new Error("Usuario inactivo");
    err.status = 403;
    throw err;
  }

  const accessToken = signAccessToken({ sub: rt.user_id, role: rt.role, clientId: rt.client_id ?? null });
  return { accessToken };
}

export async function getMe(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, phone, client_id, last_login_at, notifications
     FROM users
     WHERE id = ? AND status = 'active'`,
    [userId],
  );

  const user = rows[0];
  if (!user) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  return formatUser(user);
}

export async function forgotPassword(email) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE email = ? AND status = 'active'`,
    [email.toLowerCase().trim()],
  );
  if (!rows[0]) return; // anti-enumeration: silencioso si no existe

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  // id generado en la app (antes dependía del DEFAULT (UUID()) de la
  // columna — política definitiva de UUID de la Fase DB-3A: generar en Node
  // y enviarlo explícito, igual que ya se hacía con refresh_tokens).
  await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), rows[0].id, tokenHash, expiresAt],
  );

  return { rawToken, userId: rows[0].id };
}

export async function resetPassword(rawToken, newPassword) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { rows } = await pool.query(
    `SELECT prt.id, prt.user_id
     FROM password_reset_tokens prt
     WHERE prt.token_hash = ?
       AND prt.expires_at > now()
       AND prt.used_at IS NULL`,
    [tokenHash],
  );
  const record = rows[0];
  if (!record) {
    const err = new Error("El enlace de recuperación es inválido o ya expiró");
    err.status = 400;
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error("La contraseña debe tener al menos 8 caracteres");
    err.status = 400;
    throw err;
  }

  const newHash = await hashPassword(newPassword);
  // Nota: el orden de los placeholders en el texto ($password_hash antes que
  // $id en la versión Postgres original) no importa con `?` posicional —
  // los params van en el mismo orden en que aparecen los `?` en la query.
  await pool.query(`UPDATE users SET password_hash = ?, updated_at = now() WHERE id = ?`, [newHash, record.user_id]);
  await pool.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = ?`, [record.id]);
  // Revocar todos los refresh tokens del usuario (cerrar sesiones activas)
  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL`, [record.user_id]);
}

export async function updateProfile(userId, { name, phone, notifications }) {
  const updates = [];
  const vals = [];

  if (name !== undefined && name !== null) { updates.push(`name = ?`); vals.push(name.trim()); }
  if (phone !== undefined) { updates.push(`phone = ?`); vals.push(phone || null); }
  if (notifications !== undefined) { updates.push(`notifications = ?`); vals.push(JSON.stringify(notifications)); }

  if (updates.length === 0) return getMe(userId);

  vals.push(userId);
  await pool.query(
    `UPDATE users SET ${updates.join(", ")}, updated_at = now() WHERE id = ?`,
    vals,
  );
  return getMe(userId);
}

export async function changePassword(userId, oldPassword, newPassword) {
  const { rows } = await pool.query(
    `SELECT password_hash FROM users WHERE id = ? AND status = 'active'`,
    [userId],
  );
  const user = rows[0];
  if (!user) {
    const err = new Error("Usuario no encontrado");
    err.status = 404;
    throw err;
  }

  const valid = await verifyPassword(oldPassword, user.password_hash);
  if (!valid) {
    const err = new Error("La contraseña actual es incorrecta");
    err.status = 400;
    throw err;
  }

  if (newPassword.length < 8) {
    const err = new Error("La nueva contraseña debe tener al menos 8 caracteres");
    err.status = 400;
    throw err;
  }

  const newHash = await hashPassword(newPassword);
  await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);
}
