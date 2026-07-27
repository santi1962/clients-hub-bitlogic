import { getAdminDashboard } from "../services/dashboard.service.js";
import pool from "../db/pool.js";

export async function adminDashboard(req, res, next) {
  try {
    const data = await getAdminDashboard();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function analyticsData(req, res, next) {
  try {
    const [revenueRes, clientsRes] = await Promise.all([
      // Ingresos reales por mes (últimos 6 meses) — suma de pagos cobrados
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon') AS month,
          DATE_TRUNC('month', paid_at) AS month_date,
          COALESCE(SUM(amount), 0)::float AS revenue
        FROM payments
        WHERE
          paid_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
          AND status = 'paid'
        GROUP BY DATE_TRUNC('month', paid_at)
        ORDER BY DATE_TRUNC('month', paid_at)
      `),
      // Clientes activos acumulados al cierre de cada mes (últimos 6 meses)
      pool.query(`
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
            DATE_TRUNC('month', NOW()),
            '1 month'::interval
          ) AS month_start
        )
        SELECT
          TO_CHAR(m.month_start, 'Mon') AS month,
          m.month_start AS month_date,
          COUNT(c.id)::int AS clients
        FROM months m
        LEFT JOIN clients c
          ON c.created_at <= (m.month_start + INTERVAL '1 month' - INTERVAL '1 day')
          AND c.status = 'active'
        GROUP BY m.month_start
        ORDER BY m.month_start
      `),
    ]);

    res.json({
      revenue_trend: revenueRes.rows.map((r) => ({
        month: r.month,
        revenue: r.revenue,
      })),
      client_trend: clientsRes.rows.map((r) => ({
        month: r.month,
        clients: r.clients,
      })),
    });
  } catch (err) {
    next(err);
  }
}
