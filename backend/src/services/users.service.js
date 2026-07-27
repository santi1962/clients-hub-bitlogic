import pool from "../db/pool.js";
import bcrypt from "bcrypt";

export const usersService = {
  async listPortalUsers() {
    const { rows } = await pool.query(`
      SELECT
        c.id        AS client_id,
        c.name      AS client_name,
        c.company   AS client_company,
        u.id        AS user_id,
        u.email,
        u.status,
        u.last_login_at,
        u.created_at
      FROM clients c
      LEFT JOIN users u ON u.client_id = c.id AND u.role = 'cliente'
      ORDER BY c.name
    `);
    return rows;
  },

  async createPortalUser({ clientId, name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status, client_id)
       VALUES ($1, $2, $3, 'cliente', 'active', $4)
       RETURNING id, name, email, status, created_at`,
      [name || email, email, passwordHash, clientId],
    );
    return rows[0];
  },

  async resetPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = now()
       WHERE id = $2 AND role = 'cliente'
       RETURNING id, name, email`,
      [passwordHash, userId],
    );
    if (!rows[0]) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    return rows[0];
  },

  async deletePortalUser(userId) {
    const { rows } = await pool.query(
      `DELETE FROM users WHERE id = $1 AND role = 'cliente' RETURNING id`,
      [userId],
    );
    if (!rows[0]) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }
    return rows[0];
  },
};
