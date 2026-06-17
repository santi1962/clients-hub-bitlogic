/**
 * Job: Delinquency Detection Daily
 * Phase 4E.1: Detection only (no tasks created yet)
 */
import pool from "../db/pool.js";

export async function delinquencyDetectionDaily() {
  // Find overdue notices (> 7 days)
  const noticesQuery = `
    SELECT
      id,
      notice_number,
      client_id,
      amount,
      due_date,
      (CURRENT_DATE - due_date::date) as days_overdue
    FROM payment_notices
    WHERE status IN ('pending', 'sent')
    AND due_date < CURRENT_DATE - INTERVAL '7 days'
    ORDER BY due_date ASC
  `;

  const noticesResult = await pool.query(noticesQuery);
  const overdueNotices = noticesResult.rows;

  // Find overdue services
  const servicesQuery = `
    SELECT
      id,
      domain,
      client_id,
      next_due_date,
      monthly_price,
      (CURRENT_DATE - next_due_date::date) as days_overdue
    FROM hosting_services
    WHERE status IN ('active', 'suspended', 'overdue', 'pending_payment')
    AND next_due_date < CURRENT_DATE - INTERVAL '7 days'
    ORDER BY next_due_date ASC
  `;

  const servicesResult = await pool.query(servicesQuery);
  const overdueServices = servicesResult.rows;

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
