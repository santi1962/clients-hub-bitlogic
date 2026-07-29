/**
 * Audit Service
 * Centralizes audit logging for all system actions
 */
import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("audit-service");

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
    requestId,
  }) {
    // Best-effort a propósito (política ya existente, conservada tal cual):
    // una acción de negocio ya completada no debe fallar con 500 solo porque
    // no se pudo escribir su registro de auditoría — por eso el try/catch
    // nunca relanza. Lo que sí se corrige acá es que antes el catch usaba
    // console.error crudo, sin logger estructurado ni requestId — un fallo
    // de auditoría contra MariaDB (audit_logs sigue siendo el único punto
    // ciego real desde DB-3C) quedaba invisible en cualquier pipeline que
    // parsee logs JSON. `log.error` además redacta automáticamente claves
    // sensibles (password, token, authorization, etc.) si algún día
    // aparecieran en el objeto de error — no se agregó sanitización nueva.
    try {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO audit_logs
          (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
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
      log.error("No se pudo registrar la acción de auditoría — la operación de negocio ya se había completado y no se ve afectada", {
        requestId,
        err,
        action,
        entityType,
        entityId,
      });
    }
  },

  /**
   * List audit logs with filtering
   */
  async listLogs({
    entityType,
    entityId,
    userId,
    action,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = {}) {
    const conditions = [];
    const params = [];

    if (entityType) {
      conditions.push(`entity_type = ?`);
      params.push(entityType);
    }
    if (entityId) {
      conditions.push(`entity_id = ?`);
      params.push(entityId);
    }
    if (userId) {
      conditions.push(`user_id = ?`);
      params.push(userId);
    }
    if (action) {
      conditions.push(`action = ?`);
      params.push(action);
    }
    if (dateFrom) {
      conditions.push(`created_at >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`created_at <= ?`);
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
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
      // default, MariaDB la nombra "COUNT(*)" literal (mismo hallazgo que
      // clients.service.js/hosting.service.js en DB-3B/DB-3C).
      pool.query(`SELECT COUNT(*) AS count FROM audit_logs ${where}`, params),
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
       FROM audit_logs WHERE id = ?`,
      [id],
    );

    if (!rows[0]) {
      const e = new Error("Audit log not found");
      e.status = 404;
      throw e;
    }

    // Parseo defensivo (mismo patrón que auth.service.js formatUser() para
    // `notifications`, DB-3A): `pg` deserializa jsonb a objeto JS
    // automáticamente, así que bajo Postgres old_values/new_values YA
    // llegan como objeto — un JSON.parse() incondicional sobre eso revienta
    // con SyntaxError ("[object Object]" no es JSON válido). Bug
    // preexistente (nunca ejercitado por ningún test hasta esta fase,
    // confirmado en la auditoría DB-3D) que además es exactamente lo que
    // hace falta para que el shape sea idéntico contra MariaDB, donde la
    // columna JSON sí vuelve como string crudo.
    const parseJson = (value) => (typeof value === "string" ? JSON.parse(value) : (value ?? null));

    return {
      ...rows[0],
      oldValues: parseJson(rows[0].old_values),
      newValues: parseJson(rows[0].new_values),
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
       LIMIT ?`,
      [limit],
    );

    return rows;
  },
};
