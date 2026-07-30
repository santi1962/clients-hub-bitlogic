/**
 * Automation Settings Service
 * Manages configuration for automated jobs
 */
import pool from "../db/pool.js";
import config from "../config/index.js";

// `key` es una columna reservada en MariaDB (palabra clave KEY) — el schema
// ya la escapa con backticks en la definición de columna, y las queries acá
// necesitan lo mismo para referenciarla en SELECT/WHERE/ORDER BY. Backticks
// no son sintaxis válida en Postgres (ahí "key" no es palabra reservada, no
// hace falta escaparlo). Es el mismo tipo de caso que ON CONFLICT vs ON
// DUPLICATE KEY UPDATE (ver settings.controller.js) — varía por
// config.db.driver en vez de una sola query con `?` para ambos motores.
const KEY_COL = config.db.driver === "mysql" ? "`key`" : "key";

// `value` es jsonb en Postgres (pg lo deserializa a objeto automáticamente)
// y JSON (alias de LONGTEXT) en MariaDB, donde mysql2 devuelve el string
// crudo sin parsear — mismo hallazgo que auth.service.js formatUser() para
// `notifications` (DB-3A) y audit.service.js getLogById() para old_values/
// new_values (DB-3D). Sin este parseo defensivo, setting.value.emails
// rompería bajo MariaDB.
// enabled: TINYINT(1) en MariaDB, mysql2 lo devuelve como 0/1 en vez de
// true/false (pg sí devuelve boolean nativo) — mismo hallazgo que
// is_internal en support.service.js (DB-3F).
function parseSettingRow(row) {
  if (!row) return row;
  return {
    ...row,
    value: typeof row.value === "string" ? JSON.parse(row.value) : row.value,
    enabled: !!row.enabled,
  };
}

export const automationSettingsService = {
  /**
   * Get all settings
   */
  async getAllSettings() {
    const result = await pool.query(`SELECT * FROM automation_settings ORDER BY ${KEY_COL} ASC`);
    return result.rows.map(parseSettingRow);
  },

  /**
   * Get a specific setting by key
   */
  async getSetting(key) {
    const result = await pool.query(`SELECT * FROM automation_settings WHERE ${KEY_COL} = ?`, [key]);
    return result.rows[0] ? parseSettingRow(result.rows[0]) : null;
  },

  /**
   * Get multiple settings by keys
   */
  async getSettings(keys) {
    if (!keys || keys.length === 0) {
      return [];
    }
    const placeholders = keys.map(() => "?").join(",");
    const result = await pool.query(`SELECT * FROM automation_settings WHERE ${KEY_COL} IN (${placeholders})`, keys);
    return result.rows.map(parseSettingRow);
  },

  /**
   * Get enabled settings
   */
  async getEnabledSettings() {
    const result = await pool.query(
      `SELECT * FROM automation_settings WHERE enabled = true ORDER BY ${KEY_COL} ASC`,
    );
    return result.rows.map(parseSettingRow);
  },

  /**
   * Update a setting
   */
  async updateSetting(key, updates, userId = null) {
    const { value, enabled, description } = updates;

    // UPDATE...RETURNING -> UPDATE + SELECT posterior (mismo patrón que el
    // resto de los dominios convertidos). El 404 (setting inexistente) ya
    // lo decide el controller con un getSetting() previo, así que acá
    // alcanza con releer la misma fila vía SELECT tras el UPDATE.
    await pool.query(
      `UPDATE automation_settings
       SET
         value = COALESCE(?, value),
         enabled = COALESCE(?, enabled),
         description = COALESCE(?, description),
         updated_by = ?,
         updated_at = now()
       WHERE ${KEY_COL} = ?`,
      [
        value ? JSON.stringify(value) : null,
        enabled !== undefined ? enabled : null,
        description || null,
        userId || null,
        key,
      ],
    );

    const { rows } = await pool.query(`SELECT * FROM automation_settings WHERE ${KEY_COL} = ?`, [key]);
    return rows[0] ? parseSettingRow(rows[0]) : null;
  },

  /**
   * Enable a setting
   */
  async enableSetting(key, userId = null) {
    return this.updateSetting(key, { enabled: true }, userId);
  },

  /**
   * Disable a setting
   */
  async disableSetting(key, userId = null) {
    return this.updateSetting(key, { enabled: false }, userId);
  },

  /**
   * Get all reminder settings
   */
  async getReminderSettings() {
    const keys = [
      "reminder_7_days",
      "reminder_3_days",
      "reminder_due_today",
      "reminder_overdue_7days",
    ];
    return this.getSettings(keys);
  },

  /**
   * Check if a specific reminder is enabled
   */
  async isReminderEnabled(reminderType) {
    const setting = await this.getSetting(`reminder_${reminderType}`);
    return setting && setting.enabled;
  },

  /**
   * Get notification recipients by type
   */
  async getNotificationRecipients(type) {
    // type: 'admin' or 'finance'
    const setting = await this.getSetting(`notification_recipients_${type}`);
    if (!setting || !setting.value.emails) {
      return [];
    }
    return setting.value.emails;
  },

  /**
   * Add notification recipient
   */
  async addNotificationRecipient(type, email, userId = null) {
    const setting = await this.getSetting(`notification_recipients_${type}`);
    if (!setting) {
      throw new Error(`Setting notification_recipients_${type} not found`);
    }

    const emails = setting.value.emails || [];
    if (!emails.includes(email)) {
      emails.push(email);
    }

    return this.updateSetting(
      `notification_recipients_${type}`,
      { value: { emails } },
      userId,
    );
  },

  /**
   * Remove notification recipient
   */
  async removeNotificationRecipient(type, email, userId = null) {
    const setting = await this.getSetting(`notification_recipients_${type}`);
    if (!setting) {
      throw new Error(`Setting notification_recipients_${type} not found`);
    }

    const emails = (setting.value.emails || []).filter((e) => e !== email);

    return this.updateSetting(
      `notification_recipients_${type}`,
      { value: { emails } },
      userId,
    );
  },
};
