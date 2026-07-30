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

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function analyticsData(req, res, next) {
  try {
    // Últimos 6 meses (incluye el actual), calculados en Node en vez de
    // generate_series()/DATE_TRUNC/TO_CHAR (exclusivos de Postgres) — mismo
    // criterio que billing.service.js getGlobalSummary() (DB-3J).
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: MONTH_ABBR[d.getMonth()], year: d.getFullYear(), monthNum: d.getMonth() + 1 });
    }
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [revenueRes, clientsRes] = await Promise.all([
      // Ingresos reales por mes (últimos 6 meses) — suma de pagos cobrados.
      // date_trunc/TO_CHAR -> EXTRACT(YEAR/MONTH) agrupado, con el cutoff
      // bindeado como parámetro; el nombre del mes se arma en JS.
      pool.query(
        `
        SELECT
          EXTRACT(YEAR FROM paid_at) AS year,
          EXTRACT(MONTH FROM paid_at) AS month,
          COALESCE(SUM(amount), 0) AS revenue
        FROM payments
        WHERE paid_at >= ? AND status = 'paid'
        GROUP BY EXTRACT(YEAR FROM paid_at), EXTRACT(MONTH FROM paid_at)
      `,
        [cutoff],
      ),
      // Clientes activos acumulados al cierre de cada mes (últimos 6 meses).
      // El generate_series()+LEFT JOIN con condición de desigualdad no tiene
      // equivalente portable de una sola query -> una query de conteo por
      // mes (6 en paralelo), cada una acotada al cierre de ese mes.
      Promise.all(
        months.map(({ year, monthNum }) => {
          const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999); // último día del mes
          return pool.query(
            `SELECT COUNT(*) AS count FROM clients WHERE created_at <= ? AND status = 'active'`,
            [monthEnd],
          );
        }),
      ),
    ]);

    const revenueByKey = new Map(
      revenueRes.rows.map((r) => [`${parseInt(r.year)}-${parseInt(r.month)}`, parseFloat(r.revenue)]),
    );

    res.json({
      revenue_trend: months.map(({ month, year, monthNum }) => ({
        month,
        revenue: revenueByKey.get(`${year}-${monthNum}`) ?? 0,
      })),
      client_trend: months.map(({ month }, i) => ({
        month,
        clients: parseInt(clientsRes[i].rows[0].count),
      })),
    });
  } catch (err) {
    next(err);
  }
}
