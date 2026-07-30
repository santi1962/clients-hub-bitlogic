import pool from "../db/pool.js";
import { auditService } from "./audit.service.js";

export async function getAdminDashboard() {
  const client = await pool.connect();
  try {
    // Cortes de fecha calculados en Node en vez de NOW()/INTERVAL/DATE_TRUNC de
    // Postgres (sin equivalente portable directo) — se pasan como parámetros
    // bindeados, mismo patrón que el resto de los dominios convertidos
    // (ver domains.service.js, tasks.service.js).
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);
    const in7DaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

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
          (SELECT COUNT(*) FROM clients WHERE status = 'active') AS active_clients,
          (SELECT COUNT(*) FROM hosting_services WHERE status = 'active') AS active_services,
          (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_payments_count
      `),

      // Estadísticas de pagos. DATE_TRUNC('month', x) = DATE_TRUNC('month', NOW())
      // -> comparar año y mes por separado con EXTRACT (soportado igual en
      // Postgres y MariaDB), evita el DATE_TRUNC exclusivo de Postgres.
      client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount END), 0) AS total_debt,
          COALESCE(SUM(CASE WHEN status = 'paid'
            AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM ?)
            AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM ?)
            THEN amount END), 0) AS collected_this_month
        FROM payments
      `, [now, now]),

      // Facturación mensual estimada (servicios activos)
      client.query(`
        SELECT COALESCE(SUM(monthly_price), 0) AS monthly_revenue
        FROM hosting_services
        WHERE status = 'active'
      `),

      // Avisos vencidos
      client.query(`
        SELECT COUNT(*) AS overdue_notices
        FROM payment_notices
        WHERE status = 'overdue'
      `),

      // Clientes nuevos este mes
      client.query(`
        SELECT COUNT(*) AS new_clients
        FROM clients
        WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM ?)
          AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM ?)
      `, [now, now]),

      // Próximos vencimientos (30 días) — cutoff calculado en Node en vez de
      // NOW() + INTERVAL '30 days'.
      client.query(`
        SELECT
          hs.id, hs.domain, hs.next_due_date, hs.monthly_price, hs.status,
          c.company AS client_company, c.id AS client_id,
          hp.name AS plan_name
        FROM hosting_services hs
        JOIN clients c ON c.id = hs.client_id
        JOIN hosting_plans hp ON hp.id = hs.plan_id
        WHERE hs.status NOT IN ('suspended', 'cancelled')
          AND hs.next_due_date <= ?
        ORDER BY hs.next_due_date ASC
        LIMIT 10
      `, [in30Days]),

      // Clientes con deuda
      client.query(`
        SELECT
          c.id, c.company, c.email,
          SUM(p.amount) AS debt,
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
          p.id, p.amount, p.status, p.method, p.paid_at,
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
          n.id, n.notice_number, n.amount, n.status,
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
          (SELECT COUNT(*) FROM domains WHERE status = 'active') AS active_domains,
          (SELECT COUNT(*) FROM domains WHERE status = 'due_soon') AS due_soon_domains,
          (SELECT COUNT(*) FROM domains WHERE status = 'expired') AS expired_domains
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
          AND d.expiration_date <= ?
        ORDER BY d.expiration_date ASC
        LIMIT 8
      `, [in30Days]),

      // Conteos de tickets
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open_tickets,
          (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND priority = 'urgent') AS urgent_tickets
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
          (SELECT COUNT(*) FROM internal_tasks WHERE status = 'pending') AS pending_tasks,
          (SELECT COUNT(*) FROM internal_tasks WHERE status = 'pending' AND priority = 'urgent') AS urgent_tasks
      `),

      // Tareas vencidas — NOW()::date reemplazado por la fecha de hoy (sin
      // hora) calculada en Node y bindeada como string 'YYYY-MM-DD'.
      client.query(`
        SELECT COUNT(*) AS overdue_tasks
        FROM internal_tasks
        WHERE status IN ('pending', 'in_progress')
          AND due_date < ?
      `, [todayStr]),

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
          AND t.due_date <= ?
          AND t.due_date >= ?
        ORDER BY t.due_date ASC
        LIMIT 10
      `, [in7DaysStr, todayStr]),
    ]);

    const counts = countsRes.rows[0];
    const stats = paymentStatsRes.rows[0];
    const domainsCounts = domainsCountsRes.rows[0];

    return {
      activeClients: parseInt(counts.active_clients),
      activeServices: parseInt(counts.active_services),
      pendingPaymentsCount: parseInt(counts.pending_payments_count),
      monthlyRevenue: parseFloat(monthlyRevenueRes.rows[0].monthly_revenue),
      collectedThisMonth: parseFloat(stats.collected_this_month),
      totalDebt: parseFloat(stats.total_debt),
      overdueNoticesCount: parseInt(overdueNoticesRes.rows[0].overdue_notices),
      newClientsThisMonth: parseInt(newClientsRes.rows[0].new_clients),

      upcomingServices: upcomingServicesRes.rows.map((s) => ({
        id: s.id,
        domain: s.domain,
        nextDueDate: s.next_due_date,
        monthlyPrice: parseFloat(s.monthly_price),
        status: s.status,
        clientCompany: s.client_company,
        clientId: s.client_id,
        planName: s.plan_name,
      })),

      clientsWithDebt: clientsWithDebtRes.rows.map((c) => ({
        id: c.id,
        company: c.company,
        email: c.email,
        debt: parseFloat(c.debt),
        lastPaymentDate: c.last_payment_date ?? null,
        nextDueDate: c.next_due_date ?? null,
      })),

      recentPayments: recentPaymentsRes.rows.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount),
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
        amount: parseFloat(n.amount),
        status: n.status,
        dueDate: n.due_date,
        periodMonth: n.period_month,
        periodYear: n.period_year,
        clientCompany: n.client_company,
        serviceDomain: n.service_domain ?? null,
      })),

      activeDomainsCount: parseInt(domainsCounts.active_domains),
      dueSoonDomainsCount: parseInt(domainsCounts.due_soon_domains),
      expiredDomainsCount: parseInt(domainsCounts.expired_domains),

      upcomingDomains: upcomingDomainsRes.rows.map((d) => ({
        id: d.id,
        domain: d.domain,
        expirationDate: d.expiration_date,
        status: d.status,
        clientCompany: d.client_company,
        serviceDomain: d.service_domain ?? null,
      })),

      openTicketsCount: parseInt(ticketsCountsRes.rows[0].open_tickets),
      urgentTicketsCount: parseInt(ticketsCountsRes.rows[0].urgent_tickets),

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

      pendingTasksCount: parseInt(tasksCountsRes.rows[0].pending_tasks),
      urgentTasksCount: parseInt(tasksCountsRes.rows[0].urgent_tasks),
      overdueTasksCount: parseInt(overdueTasksRes.rows[0].overdue_tasks),

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
}
