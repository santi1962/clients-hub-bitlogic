/**
 * Automation Settings Controller
 * Admin only - configure automated job settings
 */
import { automationSettingsService } from "../services/automation-settings.service.js";
import { auditService } from "../services/audit.service.js";

export async function getAllSettings(req, res, next) {
  try {
    const settings = await automationSettingsService.getAllSettings();
    res.json({ data: settings, meta: { total: settings.length } });
  } catch (err) {
    next(err);
  }
}

export async function getSetting(req, res, next) {
  try {
    const { key } = req.params;
    const setting = await automationSettingsService.getSetting(key);

    if (!setting) {
      return res.status(404).json({ error: `Setting ${key} not found` });
    }

    res.json({ data: setting });
  } catch (err) {
    next(err);
  }
}

export async function updateSetting(req, res, next) {
  try {
    const { key } = req.params;
    const { value, enabled, description } = req.body;

    const setting = await automationSettingsService.getSetting(key);
    if (!setting) {
      return res.status(404).json({ error: `Setting ${key} not found` });
    }

    const oldValues = {
      value: setting.value,
      enabled: setting.enabled,
      description: setting.description,
    };

    const updated = await automationSettingsService.updateSetting(
      key,
      { value, enabled, description },
      req.user?.sub,
    );

    // Log changes
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "automation_setting",
      entityId: key,
      entityName: key,
      oldValues: oldValues,
      newValues: {
        value: updated.value,
        enabled: updated.enabled,
        description: updated.description,
      },
    });

    res.json({
      data: updated,
      message: `Setting ${key} updated`,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleSetting(req, res, next) {
  try {
    const { key } = req.params;
    const setting = await automationSettingsService.getSetting(key);

    if (!setting) {
      return res.status(404).json({ error: `Setting ${key} not found` });
    }

    const newEnabled = !setting.enabled;
    const updated = await automationSettingsService.updateSetting(
      key,
      { enabled: newEnabled },
      req.user?.sub,
    );

    // Log toggle
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "automation_setting",
      entityId: key,
      entityName: key,
      oldValues: { enabled: setting.enabled },
      newValues: { enabled: newEnabled },
    });

    res.json({
      data: updated,
      message: `Setting ${key} toggled to ${newEnabled}`,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReminderSettings(req, res, next) {
  try {
    const settings = await automationSettingsService.getReminderSettings();
    res.json({ data: settings, meta: { total: settings.length } });
  } catch (err) {
    next(err);
  }
}

export async function addNotificationRecipient(req, res, next) {
  try {
    const { type } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: { message: "email required" } });
    }

    const updated = await automationSettingsService.addNotificationRecipient(
      type,
      email,
      req.user?.sub,
    );

    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "automation_setting",
      entityId: `notification_recipients_${type}`,
      entityName: `notification_recipients_${type}`,
      oldValues: { action: "add_recipient", email },
    });

    res.json({
      data: updated,
      message: `Recipient ${email} added to ${type} notifications`,
    });
  } catch (err) {
    next(err);
  }
}

export async function removeNotificationRecipient(req, res, next) {
  try {
    const { type } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: { message: "email required" } });
    }

    const updated = await automationSettingsService.removeNotificationRecipient(
      type,
      email,
      req.user?.sub,
    );

    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "automation_setting",
      entityId: `notification_recipients_${type}`,
      entityName: `notification_recipients_${type}`,
      oldValues: { action: "remove_recipient", email },
    });

    res.json({
      data: updated,
      message: `Recipient ${email} removed from ${type} notifications`,
    });
  } catch (err) {
    next(err);
  }
}
