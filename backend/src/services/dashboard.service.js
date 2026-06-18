import pool from "../db/pool.js";
import { auditService } from "./audit.service.js";

export async function getAdminDashboard() {
  // COMPLETAMENTE LIMPIO - Sin datos mock
  return {
    activeClients: 0,
    activeServices: 0,
    pendingPaymentsCount: 0,
    monthlyRevenue: 0,
    collectedThisMonth: 0,
    totalDebt: 0,
    overdueNoticesCount: 0,
    newClientsThisMonth: 0,
    upcomingServices: [],
    clientsWithDebt: [],
    recentPayments: [],
    recentNotices: [],
    activeDomainsCount: 0,
    dueSoonDomainsCount: 0,
    expiredDomainsCount: 0,
    upcomingDomains: [],
    openTicketsCount: 0,
    urgentTicketsCount: 0,
    recentTickets: [],
    pendingTasksCount: 0,
    urgentTasksCount: 0,
    overdueTasksCount: 0,
    upcomingTasks: [],
    recentActivity: [],
  };

  /* CÓDIGO ORIGINAL COMENTADO
  const client = await pool.connect();
  try {
    const [
      countsRes,
      paymentStatsRes,
      monthlyRevenueRes,
      overdueNoticesRes,
      newClientsRes,
      upcomingServicesRes,
      clientsWithDebtRes,
      recentPaymentsRes,
      recentNoticesRes,
      domainsCountsRes,
      upcomingDomainsRes,
      ticketsCountsRes,
      recentTicketsRes,
      tasksCountsRes,
      overdueTasksRes,
      upcomingTasksRes,
    ] = await Promise.all([
      // Clientes y servicios activos
      client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM clients WHERE status = 'active') AS active_clients,
          (SELECT COUNT(*)::int FROM hosting_services WHERE status = 'active') AS active_services,
          (SELECT COUNT(*)::int FROM payments WHERE status = 'pending') AS pending_payments_count
      `),

      // Estadísticas de pagos
      client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount END), 0)::float AS total_debt,
          COALESCE(SUM(CASE WHEN status = 'paid'
            AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', NOW())
            THEN amount END), 0)::float AS collected_this_month
        FROM payments
      `),

      // Facturación mensual estimada (servicios activos)
      client.query(`
        SELECT COALESCE(SUM(monthly_price), 0)::float AS monthly_revenue
        FROM hosting_services
        WHERE status = 'active'
      `),

      // Avisos vencidos
      client.query(`
        SELECT COUNT(*)::int AS overdue_notices
        FROM payment_notices
        WHERE status = 'overdue'
      `),

      // Clientes nuevos este mes
      client.query(`
        SELECT COUNT(*)::int AS new_clients
        FROM clients
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `),

      // Próximos vencimientos (30 días)
      client.query(`
        SELECT
          hs.id, hs.domain, hs.next_due_date, hs.monthly_price::float, hs.status,
          c.company AS client_company, c.id AS client_id,
          hp.name AS plan_name
        FROM hosting_services hs
        JOIN clients c ON c.id = hs.client_id
        JOIN hosting_plans hp ON hp.id = hs.plan_id
        WHERE hs.status NOT IN ('suspended', 'cancelled')
          AND hs.next_due_date <= NOW() + INTERVAL '30 days'
        ORDER BY hs.next_due_date ASC
        LIMIT 10
      `),

      // Clientes con deuda
      client.query(`
        SELECT
          c.id, c.company, c.email,
          SUM(p.amount)::float AS debt,
          (SELECT MAX(p2.paid_at) FROM payments p2 WHERE p2.client_id = c.id AND p2.status = 'paid') AS last_payment_date,
          (SELECT MIN(hs.next_due_date) FROM hosting_services hs
            WHERE hs.client_id = c.id AND hs.status NOT IN ('suspended','cancelled')) AS next_due_date
        FROM clients c
        JOIN payments p ON p.client_id = c.id AND p.status IN ('pending', 'overdue')
        GROUP BY c.id, c.company, c.email
        HAVING SUM(p.amount) > 0
        ORDER BY SUM(p.amount) DESC
        LIMIT 8
      `),

      // Pagos recientes
      client.query(`
        SELECT
          p.id, p.amount::float, p.status, p.method, p.paid_at,
          p.period_month, p.period_year,
          c.company AS client_company,
          hs.domain AS service_domain
        FROM payments p
        JOIN clients c ON c.id = p.client_id
        LEFT JOIN hosting_services hs ON hs.id = p.hosting_service_id
        ORDER BY p.created_at DESC
        LIMIT 5
      `),

      // Avisos recientes
      client.query(`
        SELECT
          n.id, n.notice_number, n.amount::float, n.status,
          n.due_date, n.period_month, n.period_year,
          c.company AS client_company,
          hs.domain AS service_domain
        FROM payment_notices n
        JOIN clients c ON c.id = n.client_id
        LEFT JOIN hosting_services hs ON hs.id = n.hosting_service_id
        ORDER BY n.created_at DESC
        LIMIT 5
      `),

      // Conteos de dominios
      client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM domains WHERE status = 'active') AS active_domains,
          (SELECT COUNT(*)::int FROM domains WHERE status = 'due_soon') AS due_soon_domains,
          (SELECT COUNT(*)::int FROM domains WHERE status = 'expired') AS expired_domains
      `),

      // Próximos dominios a vencer (30 días)
      client.query(`
        SELECT
          d.id, d.domain, d.expiration_date, d.status,
          c.company AS client_company,
          hs.domain AS service_domain
        FROM domains d
        JOIN clients c ON c.id = d.client_id
        LEFT JOIN hosting_services hs ON hs.id = d.hosting_service_id
        WHERE d.status != 'cancelled'
          AND d.expiration_date <= NOW() + INTERVAL '30 days'
        ORDER BY d.expiration_date ASC
        LIMIT 8
      `),

      // Conteos de tickets
      client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
          (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open' AND priority = 'urgent') AS urgent_tickets
      `),

      // Tickets recientes
      client.query(`
        SELECT
          t.id, t.ticket_number, t.subject, t.status, t.priority,
          t.created_at, t.assigned_to, t.last_message_at,
          c.company AS client_company,
          u.name AS assigned_user_name
        FROM support_tickets t
        JOIN clients c ON c.id = t.client_id
        LEFT JOIN users u ON u.id = t.assigned_to
        ORDER BY t.created_at DESC
        LIMIT 5
      `),

      // Conteos de tareas
      client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM internal_tasks WHERE status = 'pending') AS pending_tasks,
          (SELECT COUNT(*)::int FROM internal_tasks WHERE status = 'pending' AND priority = 'urgent') AS urgent_tasks
      `),

      // Tareas vencidas
      client.query(`
        SELECT COUNT(*)::int AS overdue_tasks
        FROM internal_tasks
        WHERE status IN ('pending', 'in_progress')
          AND due_date < NOW()::date
      `),

      // Próximas tareas (próximos 7 días)
      client.query(`
        SELECT
          t.id, t.title, t.status, t.priority, t.due_date,
          t.assigned_to, COALESCE(c.company, c.name) AS client_name,
          u.name AS assigned_user_name
        FROM internal_tasks t
        LEFT JOIN clients c ON t.client_id = c.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status IN ('pending', 'in_progress')
          AND t.due_date <= NOW()::date + INTERVAL '7 days'
          AND t.due_date >= NOW()::date
        ORDER BY t.due_date ASC
        LIMIT 10
      `),
    ]);

    const counts = countsRes.rows[0];
    const stats = paymentStatsRes.rows[0];
    const domainsCounts = domainsCountsRes.rows[0];

    return {
      activeClients: counts.active_clients,
      activeServices: counts.active_services,
      pendingPaymentsCount: counts.pending_payments_count,
      monthlyRevenue: monthlyRevenueRes.rows[0].monthly_revenue,
      collectedThisMonth: stats.collected_this_month,
      totalDebt: stats.total_debt,
      overdueNoticesCount: overdueNoticesRes.rows[0].overdue_notices,
      newClientsThisMonth: newClientsRes.rows[0].new_clients,

      upcomingServices: upcomingServicesRes.rows.map((s) => ({
        id: s.id,
        domain: s.domain,
        nextDueDate: s.next_due_date,
        monthlyPrice: s.monthly_price,
        status: s.status,
        clientCompany: s.client_company,
        clientId: s.client_id,
        planName: s.plan_name,
      })),

      clientsWithDebt: clientsWithDebtRes.rows.map((c) => ({
        id: c.id,
        company: c.company,
        email: c.email,
        debt: c.debt,
        lastPaymentDate: c.last_payment_date ?? null,
        nextDueDate: c.next_due_date ?? null,
      })),

      recentPayments: recentPaymentsRes.rows.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method,
        paidAt: p.paid_at ?? null,
        periodMonth: p.period_month,
        periodYear: p.period_year,
        clientCompany: p.client_company,
        serviceDomain: p.service_domain ?? null,
      })),

      recentNotices: recentNoticesRes.rows.map((n) => ({
        id: n.id,
        noticeNumber: n.notice_number,
        amount: n.amount,
        status: n.status,
        dueDate: n.due_date,
        periodMonth: n.period_month,
        periodYear: n.period_year,
        clientCompany: n.client_company,
        serviceDomain: n.service_domain ?? null,
      })),

      activeDomainsCount: domainsCounts.active_domains,
      dueSoonDomainsCount: domainsCounts.due_soon_domains,
      expiredDomainsCount: domainsCounts.expired_domains,

      upcomingDomains: upcomingDomainsRes.rows.map((d) => ({
        id: d.id,
        domain: d.domain,
        expirationDate: d.expiration_date,
        status: d.status,
        clientCompany: d.client_company,
        serviceDomain: d.service_domain ?? null,
      })),

      openTicketsCount: ticketsCountsRes.rows[0].open_tickets,
      urgentTicketsCount: ticketsCountsRes.rows[0].urgent_tickets,

      recentTickets: recentTicketsRes.rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
        lastMessageAt: t.last_message_at,
        clientCompany: t.client_company,
        assignedUserName: t.assigned_user_name ?? null,
      })),

      pendingTasksCount: tasksCountsRes.rows[0].pending_tasks,
      urgentTasksCount: tasksCountsRes.rows[0].urgent_tasks,
      overdueTasksCount: overdueTasksRes.rows[0].overdue_tasks,

      upcomingTasks: upcomingTasksRes.rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        clientName: t.client_name ?? null,
        assignedUserName: t.assigned_user_name ?? null,
      })),

      recentActivity: await auditService.getRecentActivity(10),
    };
  } finally {
    client.release();
  }
  */
}
