/**
 * Job: Delinquency Detection Daily
 * Phase 4E.1: Detection only (no tasks created yet)
 */
import pool from "../db/pool.js";

export async function delinquencyDetectionDaily() {
  // Cutoff de 7 días calculado en Node en vez de CURRENT_DATE - INTERVAL
  // '7 days' (sintaxis Postgres) y `days_overdue` calculado en Node en vez
  // de `CURRENT_DATE - due_date::date` (resta de fechas exclusiva de
  // Postgres) — mismo criterio que dashboard.service.js/payment-reminders.job.js.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysOverdue = (dateValue) => {
    const d = new Date(dateValue);
    d.setHours(0, 0, 0, 0);
    return Math.round((today - d) / 86400000);
  };

  // Find overdue notices (> 7 days)
  const noticesQuery = `
    SELECT
      id,
      notice_number,
      client_id,
      amount,
      due_date
    FROM payment_notices
    WHERE status IN ('pending', 'sent')
    AND due_date < ?
    ORDER BY due_date ASC
  `;

  const noticesResult = await pool.query(noticesQuery, [sevenDaysAgo]);
  const overdueNotices = noticesResult.rows.map((n) => ({ ...n, days_overdue: daysOverdue(n.due_date) }));

  // Find overdue services
  const servicesQuery = `
    SELECT
      id,
      domain,
      client_id,
      next_due_date,
      monthly_price
    FROM hosting_services
    WHERE status IN ('active', 'suspended', 'overdue', 'pending_payment')
    AND next_due_date < ?
    ORDER BY next_due_date ASC
  `;

  const servicesResult = await pool.query(servicesQuery, [sevenDaysAgo]);
  const overdueServices = servicesResult.rows.map((s) => ({ ...s, days_overdue: daysOverdue(s.next_due_date) }));

  // Get unique overdue clients
  const clientIds = new Set();
  for (const notice of overdueNotices) {
    clientIds.add(notice.client_id);
  }
  for (const service of overdueServices) {
    clientIds.add(service.client_id);
  }

  // Calculate total overdue amount
  let totalOverdueAmount = 0;
  for (const notice of overdueNotices) {
    totalOverdueAmount += parseFloat(notice.amount || 0);
  }
  for (const service of overdueServices) {
    totalOverdueAmount += parseFloat(service.monthly_price || 0);
  }

  const summary = {
    overdueNotices: overdueNotices.length,
    overdueServices: overdueServices.length,
    overdueClients: clientIds.size,
    totalOverdueAmount: Math.round(totalOverdueAmount * 100) / 100,
    noticesDetails: overdueNotices.slice(0, 5).map((n) => ({
      noticeNumber: n.notice_number,
      daysOverdue: n.days_overdue,
      amount: n.amount,
    })),
    servicesDetails: overdueServices.slice(0, 5).map((s) => ({
      domain: s.domain,
      daysOverdue: s.days_overdue,
      monthlyPrice: s.monthly_price,
    })),
  };

  console.log(`[Job] delinquencyDetectionDaily: ${overdueNotices.length} notices, ${overdueServices.length} services overdue`);

  return summary;
}
