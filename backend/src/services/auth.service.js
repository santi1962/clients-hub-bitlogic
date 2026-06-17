import { randomBytes, createHash, randomUUID } from "crypto";
import pool from "../db/pool.js";
import { verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import config from "../config/index.js";

function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone ?? null,
    clientId: row.client_id ?? null,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function findActiveUserByEmail(email) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1 AND status = 'active'`, [
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

  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
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

  await pool.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const { rawToken: refreshToken, expiresAt: refreshExpiry } = await issueRefreshToken(
    user.id,
    remember,
  );

  return { accessToken, refreshToken, refreshExpiry, user: formatUser(user) };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
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
    `SELECT rt.user_id, u.role, u.status
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
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

  const accessToken = signAccessToken({ sub: rt.user_id, role: rt.role });
  return { accessToken };
}

export async function getMe(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, phone, client_id, last_login_at
     FROM users
     WHERE id = $1 AND status = 'active'`,
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
