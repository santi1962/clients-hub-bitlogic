/**
 * Job: Payment Reminders Daily
 * Sends email reminders for upcoming payment notices
 * Only sends if automation_settings enables the specific reminder type
 */
import pool from "../db/pool.js";
import { emailService } from "../services/email.service.js";
import { automationSettingsService } from "../services/automation-settings.service.js";
import { sendWhatsAppMessage } from "../services/whatsapp.service.js";
import config from "../config/index.js";

export async function paymentRemindersDaily() {
  const summary = {
    scannedNotices: 0,
    reminders7DaysFound: 0,
    reminders3DaysFound: 0,
    remindersDueTodayFound: 0,
    sent: 0,
    skippedDuplicates: 0,
    failed: 0,
    dryRun: false,
  };

  try {
    // Check if each reminder type is enabled
    const reminder7Enabled = await automationSettingsService.isReminderEnabled("7_days");
    const reminder3Enabled = await automationSettingsService.isReminderEnabled("3_days");
    const reminderTodayEnabled = await automationSettingsService.isReminderEnabled("due_today");

    // If all disabled, return early
    if (!reminder7Enabled && !reminder3Enabled && !reminderTodayEnabled) {
      return {
        ...summary,
        message: "All reminder types disabled",
      };
    }

    // Query payment notices with client info. `days_until_due` se calcula en
    // Node (no en SQL): `pn.due_date::date - CURRENT_DATE` es aritmética de
    // fechas exclusiva de Postgres, sin equivalente portable de una sola
    // query — mismo criterio que dashboard.service.js (DB-3I).
    const query = `
      SELECT
        pn.id,
        pn.notice_number,
        pn.client_id,
        pn.amount,
        pn.due_date,
        pn.status,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company
      FROM payment_notices pn
      JOIN clients c ON pn.client_id = c.id
      WHERE pn.status IN ('pending', 'sent')
      AND pn.due_date IS NOT NULL
      ORDER BY pn.due_date ASC
    `;

    const result = await pool.query(query);
    const notices = result.rows;
    summary.scannedNotices = notices.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process each notice
    for (const notice of notices) {
      const dueDate = new Date(notice.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((dueDate - today) / 86400000);

      // Check which reminders should be sent
      let reminderType = null;

      if (daysUntilDue === 7 && reminder7Enabled) {
        reminderType = "reminder_7_days";
        summary.reminders7DaysFound++;
      } else if (daysUntilDue === 3 && reminder3Enabled) {
        reminderType = "reminder_3_days";
        summary.reminders3DaysFound++;
      } else if (daysUntilDue === 0 && reminderTodayEnabled) {
        reminderType = "reminder_due_today";
        summary.remindersDueTodayFound++;
      }

      // Skip if no reminder should be sent
      if (!reminderType) {
        continue;
      }

      try {
        // Check if already sent today (prevent duplicates)
        const duplicateCheck = await pool.query(
          `
          SELECT id FROM payment_reminder_logs
          WHERE notice_id = ?
          AND reminder_type = ?
          AND sent_date = CURRENT_DATE
          LIMIT 1
          `,
          [notice.id, reminderType],
        );

        if (duplicateCheck.rows.length > 0) {
          console.log(`[Job] Skipping duplicate reminder for ${notice.notice_number}`);
          summary.skippedDuplicates++;
          continue;
        }

        // Send email
        const emailResult = await emailService.sendPaymentNoticeEmail(notice.id);

        // Recordatorio por WhatsApp (best-effort, no bloquea si falla o no está conectado)
        if (config.whatsapp.enabled && notice.contact_phone) {
          const label =
            reminderType === "reminder_due_today" ? "vence hoy" : `vence en ${daysUntilDue} días`;
          sendWhatsAppMessage(
            notice.contact_phone,
            `Hola ${notice.company}, te recordamos que tu aviso de pago ${notice.notice_number} por $${notice.amount} ${label} (${notice.due_date.toISOString?.().slice(0, 10) ?? notice.due_date}). Gracias por confiar en Bitlogic.`,
          ).catch(() => {});
        }

        // Log reminder sent
        await pool.query(
          `
          INSERT INTO payment_reminder_logs
          (notice_id, reminder_type, recipient, status)
          VALUES (?, ?, ?, ?)
          `,
          [notice.id, reminderType, notice.contact_email, "sent"],
        );

        summary.sent++;
        console.log(`[Job] Sent ${reminderType} to ${notice.contact_email} for ${notice.notice_number}`);
      } catch (err) {
        summary.failed++;
        console.error(`[Job] Error sending reminder for ${notice.notice_number}:`, err.message);

        // Log failed reminder
        await pool.query(
          `
          INSERT INTO payment_reminder_logs
          (notice_id, reminder_type, recipient, status, error_message)
          VALUES (?, ?, ?, ?, ?)
          `,
          [notice.id, reminderType, notice.contact_email, "failed", err.message],
        );
      }
    }

    return summary;
  } catch (err) {
    console.error("[Job] paymentRemindersDaily error:", err.message);
    throw err;
  }
}
