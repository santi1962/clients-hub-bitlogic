/**
 * Audit Service
 * Centralizes audit logging for all system actions
 */
import pool from "../db/pool.js";

export const auditService = {
  /**
   * Log an action to the audit trail
   */
  async logAction({
    user,
    action,
    entityType,
    entityId,
    entityName,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
  }) {
    try {
      await pool.query(
        `INSERT INTO audit_logs
          (user_id, user_name, user_role, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          user?.id || null,
          user?.name || "System",
          user?.role || "system",
          action,
          entityType,
          entityId,
          entityName || null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress || null,
          userAgent || null,
        ],
      );
    } catch (err) {
      console.error("Error logging audit action:", err);
    }
  },

  /**
   * List audit logs with filtering
   */
  async listLogs({
    entityType,
    userId,
    action,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = {}) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (entityType) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(entityType);
    }
    if (userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(userId);
    }
    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (dateFrom) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, created_at
         FROM audit_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM audit_logs ${where}`, params),
    ]);

    return {
      data: dataRes.rows,
      meta: { page, limit, total: parseInt(countRes.rows[0].count) },
    };
  },

  /**
   * Get audit log details
   */
  async getLogById(id) {
    const { rows } = await pool.query(
      `SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address, user_agent, created_at
       FROM audit_logs WHERE id = $1`,
      [id],
    );

    if (!rows[0]) {
      const e = new Error("Audit log not found");
      e.status = 404;
      throw e;
    }

    return {
      ...rows[0],
      oldValues: rows[0].old_values ? JSON.parse(rows[0].old_values) : null,
      newValues: rows[0].new_values ? JSON.parse(rows[0].new_values) : null,
    };
  },

  /**
   * Get recent activity for dashboard
   */
  async getRecentActivity(limit = 10) {
    const { rows } = await pool.query(
      `SELECT id, user_name, user_role, action, entity_type, entity_name, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    return rows;
  },
};
