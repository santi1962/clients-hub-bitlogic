/**
 * Automation Settings Service
 * Manages configuration for automated jobs
 */
import pool from "../db/pool.js";

export const automationSettingsService = {
  /**
   * Get all settings
   */
  async getAllSettings() {
    const query = "SELECT * FROM automation_settings ORDER BY key ASC";
    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Get a specific setting by key
   */
  async getSetting(key) {
    const query = "SELECT * FROM automation_settings WHERE key = $1";
    const result = await pool.query(query, [key]);
    return result.rows[0] || null;
  },

  /**
   * Get multiple settings by keys
   */
  async getSettings(keys) {
    if (!keys || keys.length === 0) {
      return [];
    }
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
    const query = `SELECT * FROM automation_settings WHERE key IN (${placeholders})`;
    const result = await pool.query(query, keys);
    return result.rows;
  },

  /**
   * Get enabled settings
   */
  async getEnabledSettings() {
    const query = `
      SELECT * FROM automation_settings
      WHERE enabled = true
      ORDER BY key ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Update a setting
   */
  async updateSetting(key, updates, userId = null) {
    const { value, enabled, description } = updates;

    const query = `
      UPDATE automation_settings
      SET
        value = COALESCE($1, value),
        enabled = COALESCE($2, enabled),
        description = COALESCE($3, description),
        updated_by = $4,
        updated_at = now()
      WHERE key = $5
      RETURNING *
    `;

    const result = await pool.query(query, [
      value ? JSON.stringify(value) : null,
      enabled !== undefined ? enabled : null,
      description || null,
      userId || null,
      key,
    ]);

    return result.rows[0] || null;
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
