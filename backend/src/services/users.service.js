import { randomUUID } from "crypto";
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
    // id generado en la app (UUID v4) — MariaDB no soporta UPDATE...RETURNING
    // y para mantener una única estrategia consistente en todo el dominio
    // (ver resetPassword/deletePortalUser abajo), INSERT tampoco usa
    // RETURNING acá: como el id ya se conoce de antemano, alcanza con un
    // SELECT posterior para traer created_at (generado por la DB) tal cual
    // hoy lo devuelve el cliente.
    const id = randomUUID();
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, client_id)
       VALUES (?, ?, ?, ?, 'cliente', 'active', ?)`,
      [id, name || email, email, passwordHash, clientId],
    );
    const { rows } = await pool.query(
      `SELECT id, name, email, status, created_at FROM users WHERE id = ?`,
      [id],
    );
    return rows[0];
  },

  async resetPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // UPDATE...RETURNING no existe en MariaDB: se ejecuta el UPDATE y, en la
    // misma conexión/transacción, un SELECT con la misma condición exacta
    // del WHERE — más la revocación de refresh tokens, que ya formaba parte
    // del mismo flujo lógico (cambiar la contraseña cierra las sesiones
    // activas) y ahora queda atómica con él.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rowCount } = await client.query(
        `UPDATE users SET password_hash = ?, updated_at = now()
         WHERE id = ? AND role = 'cliente'`,
        [passwordHash, userId],
      );
      if (rowCount === 0) {
        const err = new Error("User not found");
        err.status = 404;
        throw err;
      }

      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL`,
        [userId],
      );

      const { rows } = await client.query(
        `SELECT id, name, email FROM users WHERE id = ? AND role = 'cliente'`,
        [userId],
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  async deletePortalUser(userId) {
    // DELETE...RETURNING id es trivial de reemplazar sin round-trip extra:
    // el id devuelto siempre es el mismo que se pasó por parámetro.
    const { rowCount } = await pool.query(
      `DELETE FROM users WHERE id = ? AND role = 'cliente'`,
      [userId],
    );
    if (rowCount === 0) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }
    return { id: userId };
  },
};
