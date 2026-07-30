import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";
import { getCompanySettings } from "./settings.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MariaDB exige un identificador sin comillas (`NEXTVAL(seq)`), igual que ya
// se usa dentro del trigger de ticket_number.
const NEXTVAL_NOTICE_SEQ_SQL = `SELECT NEXTVAL(payment_notice_number_seq) AS n`;

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
const NOTICE_SELECT = `
  SELECT
    pn.*,
    c.name    AS client_name,
    c.company AS client_company,
    c.email   AS client_email,
    c.phone   AS client_phone,
    hs.domain AS service_domain,
    hp.name   AS plan_name
  FROM payment_notices pn
  LEFT JOIN clients            c  ON c.id  = pn.client_id
  LEFT JOIN hosting_services   hs ON hs.id = pn.hosting_service_id
  LEFT JOIN hosting_plans      hp ON hp.id = hs.plan_id
`;

const PAYMENT_SELECT = `
  SELECT
    p.*,
    c.name    AS client_name,
    c.company AS client_company,
    hs.domain AS service_domain,
    pn.notice_number
  FROM payments p
  LEFT JOIN clients           c  ON c.id  = p.client_id
  LEFT JOIN hosting_services  hs ON hs.id = p.hosting_service_id
  LEFT JOIN payment_notices   pn ON pn.id = p.payment_notice_id
`;

function formatNotice(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    hostingServiceId: row.hosting_service_id,
    noticeNumber: row.notice_number,
    periodMonth: parseInt(row.period_month),
    periodYear: parseInt(row.period_year),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    amount: parseFloat(row.amount),
    status: row.status,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    notes: row.notes ?? null,
    clientName: row.client_name ?? null,
    clientCompany: row.client_company ?? null,
    clientEmail: row.client_email ?? null,
    clientPhone: row.client_phone ?? null,
    serviceDomain: row.service_domain ?? null,
    planName: row.plan_name ?? null,
    createdAt: row.created_at,
  };
}

function formatPayment(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    hostingServiceId: row.hosting_service_id,
    paymentNoticeId: row.payment_notice_id ?? null,
    periodMonth: parseInt(row.period_month),
    periodYear: parseInt(row.period_year),
    amount: parseFloat(row.amount),
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    reference: row.reference ?? null,
    internalNotes: row.internal_notes ?? null,
    clientName: row.client_name ?? null,
    clientCompany: row.client_company ?? null,
    serviceDomain: row.service_domain ?? null,
    noticeNumber: row.notice_number ?? null,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Notices
// ─────────────────────────────────────────────────────────────
export async function listNotices({
  clientId,
  serviceId,
  status,
  search,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    conditions.push(`pn.client_id = ?`);
    params.push(clientId);
  }
  if (serviceId) {
    conditions.push(`pn.hosting_service_id = ?`);
    params.push(serviceId);
  }
  if (status) {
    conditions.push(`pn.status = ?`);
    params.push(status);
  }
  if (search) {
    // ILIKE (Postgres) -> LOWER()/LIKE, portable en ambos motores sin
    // depender del collation de la columna (mismo criterio que clients/tasks).
    conditions.push(
      `(LOWER(c.company) LIKE LOWER(?) OR LOWER(c.name) LIKE LOWER(?) OR LOWER(hs.domain) LIKE LOWER(?) OR LOWER(pn.notice_number) LIKE LOWER(?))`,
    );
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `${NOTICE_SELECT} ${where} ORDER BY pn.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM payment_notices pn
       LEFT JOIN clients c ON c.id = pn.client_id
       LEFT JOIN hosting_services hs ON hs.id = pn.hosting_service_id
       ${where}`,
      params,
    ),
  ]);

  return {
    data: dataRes.rows.map(formatNotice),
    meta: { page, limit, total: parseInt(countRes.rows[0].count) },
  };
}

export async function getNoticeById(id) {
  const { rows } = await pool.query(`${NOTICE_SELECT} WHERE pn.id = ?`, [id]);
  if (!rows[0]) {
    const e = new Error("Aviso no encontrado");
    e.status = 404;
    throw e;
  }
  return formatNotice(rows[0]);
}

export async function createNotice({
  clientId,
  hostingServiceId,
  periodMonth,
  periodYear,
  dueDate,
  amount,
  notes,
} = {}) {
  if (!clientId || !hostingServiceId || !periodMonth || !periodYear || !dueDate) {
    const e = new Error(
      "Faltan campos requeridos: clientId, hostingServiceId, periodMonth, periodYear, dueDate",
    );
    e.status = 400;
    throw e;
  }

  // Usar monto del servicio si no se proporciona
  let noticeAmount = amount;
  if (!noticeAmount) {
    const { rows } = await pool.query(`SELECT monthly_price FROM hosting_services WHERE id = ?`, [
      hostingServiceId,
    ]);
    if (!rows[0]) {
      const e = new Error("Servicio no encontrado");
      e.status = 404;
      throw e;
    }
    noticeAmount = parseFloat(rows[0].monthly_price);
  }

  // Generar número de aviso
  const {
    rows: [seqRow],
  } = await pool.query(NEXTVAL_NOTICE_SEQ_SQL);
  const noticeNumber = `AV-${periodYear}-${String(seqRow.n).padStart(4, "0")}`;

  // UUID v4 generado en la app (misma política que el resto de los dominios
  // convertidos) — INSERT sin RETURNING, se conoce el id de antemano.
  const id = randomUUID();
  await pool.query(
    `INSERT INTO payment_notices (id, client_id, hosting_service_id, notice_number, period_month, period_year, due_date, amount, status, notes)
     VALUES (?,?,?,?,?,?,?,?,'pending',?)`,
    [
      id,
      clientId,
      hostingServiceId,
      noticeNumber,
      periodMonth,
      periodYear,
      dueDate,
      noticeAmount,
      notes ?? null,
    ],
  );

  return getNoticeById(id);
}

export async function updateNotice(id, data) {
  const { dueDate, amount, notes, status } = data;
  // UPDATE...RETURNING -> el 404 se decide con un getNoticeById previo (ya
  // lanza 404), no con rowCount: un UPDATE con COALESCE puede no cambiar
  // ningún valor real (rowCount=0 en MariaDB sin CLIENT_FOUND_ROWS) aunque
  // la fila exista — mismo criterio que el resto de los dominios.
  await getNoticeById(id);
  await pool.query(
    `UPDATE payment_notices SET
       due_date = COALESCE(?, due_date),
       amount   = COALESCE(?, amount),
       notes    = COALESCE(?, notes),
       status   = COALESCE(?, status)
     WHERE id = ?`,
    [dueDate ?? null, amount ?? null, notes ?? null, status ?? null, id],
  );
  return getNoticeById(id);
}

export async function sendNotice(id) {
  // WHERE excluye el estado destino ('sent') de los estados de origen
  // permitidos -> un UPDATE que matchea SIEMPRE cambia el valor, rowCount es
  // seguro en ambos motores (mismo patrón que suspendService/reactivateService).
  const { rowCount } = await pool.query(
    `UPDATE payment_notices SET status = 'sent', sent_at = now()
     WHERE id = ? AND status IN ('draft','pending')`,
    [id],
  );
  if (!rowCount) {
    const e = new Error("Aviso no encontrado o no está en estado enviable");
    e.status = 404;
    throw e;
  }
  return getNoticeById(id);
}

export async function cancelNotice(id) {
  // Mismo criterio que sendNotice: WHERE excluye 'cancelled' de los estados
  // de origen -> rowCount seguro.
  const { rowCount } = await pool.query(
    `UPDATE payment_notices SET status = 'cancelled'
     WHERE id = ? AND status NOT IN ('paid','cancelled')`,
    [id],
  );
  if (!rowCount) {
    const e = new Error("Aviso no encontrado o no se puede cancelar");
    e.status = 404;
    throw e;
  }
  return getNoticeById(id);
}

export async function deleteNotice(id) {
  // DELETE sin RETURNING: rowCount siempre seguro para decidir 404 (sin la
  // ambigüedad de "matcheó pero no cambió ningún valor" que sí tiene UPDATE).
  const { rowCount } = await pool.query(
    `DELETE FROM payment_notices WHERE id = ? AND status != 'paid'`,
    [id],
  );
  if (!rowCount) {
    const e = new Error("Aviso no encontrado o no se puede eliminar un aviso ya pagado");
    e.status = 404;
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────
export async function listPayments({
  clientId,
  serviceId,
  status,
  method,
  periodMonth,
  periodYear,
  page = 1,
  limit = 50,
} = {}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    conditions.push(`p.client_id = ?`);
    params.push(clientId);
  }
  if (serviceId) {
    conditions.push(`p.hosting_service_id = ?`);
    params.push(serviceId);
  }
  if (status) {
    conditions.push(`p.status = ?`);
    params.push(status);
  }
  if (method) {
    conditions.push(`p.method = ?`);
    params.push(method);
  }
  if (periodMonth) {
    conditions.push(`p.period_month = ?`);
    params.push(parseInt(periodMonth));
  }
  if (periodYear) {
    conditions.push(`p.period_year = ?`);
    params.push(parseInt(periodYear));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `${PAYMENT_SELECT} ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) AS count FROM payments p ${where}`, params),
  ]);

  return {
    data: dataRes.rows.map(formatPayment),
    meta: { page, limit, total: parseInt(countRes.rows[0].count) },
  };
}

export async function getPaymentById(id) {
  const { rows } = await pool.query(`${PAYMENT_SELECT} WHERE p.id = ?`, [id]);
  if (!rows[0]) {
    const e = new Error("Pago no encontrado");
    e.status = 404;
    throw e;
  }
  return formatPayment(rows[0]);
}

export async function createPayment({
  clientId,
  hostingServiceId,
  paymentNoticeId,
  periodMonth,
  periodYear,
  amount,
  method,
  paidAt,
  reference,
  internalNotes,
} = {}) {
  if (!clientId || !periodMonth || !periodYear || !amount) {
    const e = new Error("Faltan campos requeridos: clientId, periodMonth, periodYear, amount");
    e.status = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const status = paidAt ? "paid" : "pending";
    const id = randomUUID();
    await client.query(
      `INSERT INTO payments (id, client_id, hosting_service_id, payment_notice_id, period_month, period_year, amount, method, status, paid_at, reference, internal_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        clientId,
        hostingServiceId ?? null,
        paymentNoticeId ?? null,
        periodMonth,
        periodYear,
        amount,
        method ?? "manual",
        status,
        paidAt ?? null,
        reference ?? null,
        internalNotes ?? null,
      ],
    );

    // Si hay aviso y pago con fecha, marcar aviso como pagado
    if (paymentNoticeId && paidAt) {
      await client.query(`UPDATE payment_notices SET status = 'paid', paid_at = ? WHERE id = ?`, [
        paidAt,
        paymentNoticeId,
      ]);
    }

    await client.query("COMMIT");
    return getPaymentById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePayment(id, data) {
  const { amount, method, status, paidAt, reference, internalNotes } = data;
  // Mismo criterio que updateNotice: 404 decidido por un SELECT previo, no
  // por rowCount (COALESCE puede no cambiar ningún valor real).
  await getPaymentById(id);
  await pool.query(
    `UPDATE payments SET
       amount         = COALESCE(?, amount),
       method         = COALESCE(?, method),
       status         = COALESCE(?, status),
       paid_at        = COALESCE(?, paid_at),
       reference      = COALESCE(?, reference),
       internal_notes = COALESCE(?, internal_notes)
     WHERE id = ?`,
    [
      amount ?? null,
      method ?? null,
      status ?? null,
      paidAt ?? null,
      reference ?? null,
      internalNotes ?? null,
      id,
    ],
  );
  return getPaymentById(id);
}

export async function markPaid(id) {
  // Se lee antes de la transacción para conocer payment_notice_id (antes
  // salía del RETURNING *, que no tiene equivalente con `?` sin CTE) y para
  // dar 404 si el pago no existe en absoluto.
  const existing = await getPaymentById(id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // WHERE excluye 'paid' del estado de origen -> rowCount seguro (mismo
    // patrón que sendNotice/cancelNotice).
    const { rowCount } = await client.query(
      `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = ? AND status != 'paid'`,
      [id],
    );
    if (!rowCount) {
      const e = new Error("Pago no encontrado o ya está pagado");
      e.status = 404;
      throw e;
    }

    // Marcar aviso relacionado si existe
    if (existing.paymentNoticeId) {
      await client.query(
        `UPDATE payment_notices SET status = 'paid', paid_at = now() WHERE id = ?`,
        [existing.paymentNoticeId],
      );
    }
    await client.query("COMMIT");
    return getPaymentById(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePayment(id) {
  // Se lee antes de borrar (equivalente al DELETE...RETURNING * original)
  // para saber si hay que revertir el aviso relacionado.
  const existing = await getPaymentById(id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(`DELETE FROM payments WHERE id = ?`, [id]);
    if (!rowCount) {
      const e = new Error("Pago no encontrado");
      e.status = 404;
      throw e;
    }

    // Revertir aviso relacionado si quedó marcado como pagado por este pago
    if (existing.paymentNoticeId && existing.status === "paid") {
      await client.query(
        `UPDATE payment_notices SET status = 'pending', paid_at = NULL WHERE id = ? AND status = 'paid'`,
        [existing.paymentNoticeId],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// Summaries
// ─────────────────────────────────────────────────────────────
export async function getClientSummary(clientId) {
  // FILTER (WHERE ...) es exclusivo de Postgres -> COUNT/SUM/MAX/MIN con
  // CASE WHEN, estándar SQL, mismo resultado en ambos motores (mismo
  // criterio que clients.service.js desde DB-3B).
  const [paymentRow, noticeRow, serviceRow] = await Promise.all([
    pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'paid'    THEN amount END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) AS total_pending,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount END), 0) AS total_overdue,
        MAX(CASE WHEN status = 'paid' THEN paid_at END)                AS last_payment_date
      FROM payments WHERE client_id = ?
    `,
      [clientId],
    ),
    pool.query(
      `
      SELECT
        COUNT(CASE WHEN status IN ('pending','sent') THEN 1 END) AS notices_pending,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END)           AS notices_overdue
      FROM payment_notices WHERE client_id = ?
    `,
      [clientId],
    ),
    pool.query(
      `
      SELECT
        COUNT(CASE WHEN status NOT IN ('cancelled','suspended') THEN 1 END) AS services_count,
        MIN(CASE WHEN status NOT IN ('cancelled','suspended') THEN next_due_date END) AS next_due_date
      FROM hosting_services WHERE client_id = ?
    `,
      [clientId],
    ),
  ]);

  const p = paymentRow.rows[0];
  const n = noticeRow.rows[0];
  const s = serviceRow.rows[0];

  return {
    totalPaid: parseFloat(p.total_paid),
    totalPending: parseFloat(p.total_pending),
    totalOverdue: parseFloat(p.total_overdue),
    debt: parseFloat(p.total_pending) + parseFloat(p.total_overdue),
    lastPaymentDate: p.last_payment_date,
    servicesCount: parseInt(s.services_count),
    noticesPending: parseInt(n.notices_pending),
    noticesOverdue: parseInt(n.notices_overdue),
    nextDueDate: s.next_due_date,
  };
}

export async function getGlobalSummary() {
  const now = new Date();
  // Últimos 12 meses (incluye el actual), calculados en Node en vez de
  // generate_series() (exclusivo de Postgres, sin equivalente en MariaDB).
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  const monthsCutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [revenueRow, paymentsRow, noticeCountRow, revenueMonthsRow, planDist, overduePayments] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(monthly_price),0) AS monthly FROM hosting_services WHERE status NOT IN ('cancelled','suspended')`,
      ),
      // date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE) ->
      // comparar año y mes por separado con EXTRACT (portable, mismo
      // criterio que dashboard.service.js en DB-3I). FILTER -> CASE WHEN.
      pool.query(
        `
      SELECT
        COALESCE(SUM(CASE WHEN status='paid'
          AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM ?)
          AND EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM ?)
          THEN amount END), 0) AS collected_this_month,
        COALESCE(SUM(CASE WHEN status='pending' THEN amount END), 0) AS pending_total,
        COALESCE(SUM(CASE WHEN status='overdue' THEN amount END), 0) AS overdue_total
      FROM payments
    `,
        [now, now],
      ),
      pool.query(`
      SELECT
        COUNT(CASE WHEN status IN ('pending','sent') THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status='overdue' THEN 1 END)             AS overdue_count
      FROM payment_notices
    `),
      // Suma de pagos cobrados por año/mes en la ventana de 12 meses -> se
      // combina con `months` (arriba) en JS para rellenar con 0 los meses
      // sin cobros, reemplazando el WITH months AS (generate_series(...)).
      pool.query(
        `
      SELECT
        EXTRACT(YEAR  FROM paid_at) AS year,
        EXTRACT(MONTH FROM paid_at) AS month,
        COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE status = 'paid' AND paid_at >= ?
      GROUP BY EXTRACT(YEAR FROM paid_at), EXTRACT(MONTH FROM paid_at)
    `,
        [monthsCutoff],
      ),
      pool.query(`
      SELECT hp.name, COUNT(hs.id) AS value
      FROM hosting_plans hp
      LEFT JOIN hosting_services hs ON hs.plan_id = hp.id AND hs.status NOT IN ('cancelled')
      GROUP BY hp.id, hp.name ORDER BY hp.monthly_price ASC
    `),
      pool.query(`
      SELECT p.id, p.client_id, p.amount, p.status, p.period_month, p.period_year,
             c.company AS client_company, hs.domain AS service_domain
      FROM payments p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN hosting_services hs ON hs.id = p.hosting_service_id
      WHERE p.status = 'overdue'
      ORDER BY p.created_at DESC LIMIT 20
    `),
    ]);

  const monthly = parseFloat(revenueRow.rows[0].monthly);
  const pr = paymentsRow.rows[0];
  const nc = noticeCountRow.rows[0];
  const collectedThisMonth = parseFloat(pr.collected_this_month);

  const totalsByKey = new Map(
    revenueMonthsRow.rows.map((r) => [`${parseInt(r.year)}-${parseInt(r.month)}`, parseFloat(r.total)]),
  );
  const revenueLast12Months = months.map(({ month, year }) => ({
    month,
    year,
    total: totalsByKey.get(`${year}-${month}`) ?? 0,
  }));

  return {
    monthly,
    annualProjection: monthly * 12,
    collectedThisMonth,
    pending: parseFloat(pr.pending_total),
    debt: parseFloat(pr.overdue_total),
    pendingNoticesCount: parseInt(nc.pending_count),
    overdueNoticesCount: parseInt(nc.overdue_count),
    revenueLast12Months,
    paidVsPending: [
      { name: "Cobrado", value: collectedThisMonth },
      { name: "Pendiente", value: parseFloat(pr.pending_total) },
      { name: "Vencido", value: parseFloat(pr.overdue_total) },
    ],
    planDistribution: planDist.rows.map((r) => ({ name: r.name, value: parseInt(r.value) })),
    overduePayments: overduePayments.rows.map((p) => ({
      id: p.id,
      clientId: p.client_id,
      clientCompany: p.client_company,
      serviceDomain: p.service_domain,
      periodMonth: parseInt(p.period_month),
      periodYear: parseInt(p.period_year),
      amount: parseFloat(p.amount),
      status: p.status,
    })),
  };
}

async function loadTrimmedLogoBuffer(company) {
  if (!company?.logoUrl) return null;
  const filename = path.basename(company.logoUrl);
  const candidate = path.join(__dirname, "../../uploads/logos", filename);
  if (!fs.existsSync(candidate)) return null;
  try {
    const img = await Jimp.read(candidate);
    await img.autocrop();
    const buffer = await img.getBuffer("image/png");
    return { buffer, width: img.width, height: img.height };
  } catch {
    return null; // logo corrupto/ilegible -> se usa el fallback de texto
  }
}

export async function generateNoticePdf(noticeId) {
  const notice = await getNoticeById(noticeId);
  const company = await getCompanySettings();
  const logo = await loadTrimmedLogoBuffer(company);

  const PAGE_W = 595.28; // A4
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2; // 495.28

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const formatARS = (n) => `$${parseFloat(n).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
    const formatDateStr = (s) => s ? new Date(s).toLocaleDateString("es-AR") : "—";
    const statusMeta = {
      pending: { label: "Pendiente", fg: "#92400e", bg: "#fef3c7" },
      sent: { label: "Enviado", fg: "#1e40af", bg: "#dbeafe" },
      paid: { label: "Pagado", fg: "#065f46", bg: "#d1fae5" },
      overdue: { label: "Vencido", fg: "#991b1b", bg: "#fee2e2" },
      cancelled: { label: "Cancelado", fg: "#374151", bg: "#f3f4f6" },
    };
    const status = statusMeta[notice.status] ?? { label: notice.status, fg: "#374151", bg: "#f3f4f6" };

    // ── Header: logo + título/número/estado ─────────────────────
    const companyName = company?.companyName || "BITLOGIC";
    if (logo) {
      const h = 34;
      const w = (logo.width / logo.height) * h;
      doc.image(logo.buffer, MARGIN, 45, { width: w, height: h });
    } else {
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#4f46e5").text(companyName.toUpperCase(), MARGIN, 48);
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text("Servicios de Hosting y Tecnología", MARGIN, 72);
    }

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#111827").text("AVISO DE PAGO", MARGIN, 45, { align: "right", width: CONTENT_W });
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
      .text(`N°: ${notice.noticeNumber ?? "—"}`, MARGIN, 68, { align: "right", width: CONTENT_W });

    const statusLabelWidth = doc.fontSize(9).font("Helvetica-Bold").widthOfString(status.label) + 16;
    doc.roundedRect(PAGE_W - MARGIN - statusLabelWidth, 84, statusLabelWidth, 16, 8).fillColor(status.bg).fill();
    doc.fontSize(9).font("Helvetica-Bold").fillColor(status.fg)
      .text(status.label, PAGE_W - MARGIN - statusLabelWidth, 88, { align: "center", width: statusLabelWidth });

    doc.moveTo(MARGIN, 115).lineTo(PAGE_W - MARGIN, 115).strokeColor("#e5e7eb").lineWidth(1).stroke();

    // ── Cliente (izq) + fechas (der) ──────────────────────────────
    const colY = 135;
    let ly = colY;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827")
      .text(notice.clientCompany || notice.clientName || "—", MARGIN, ly);
    ly += 16;
    doc.fontSize(9).font("Helvetica").fillColor("#4b5563");
    if (notice.clientCompany && notice.clientName) { doc.text(notice.clientName, MARGIN, ly); ly += 13; }
    if (notice.clientEmail) { doc.text(notice.clientEmail, MARGIN, ly); ly += 13; }
    if (notice.clientPhone) { doc.text(notice.clientPhone, MARGIN, ly); ly += 13; }

    const rightColX = MARGIN + CONTENT_W / 2;
    const rightColW = CONTENT_W / 2;
    const month = notice.periodMonth ? MONTHS[notice.periodMonth - 1] : "—";
    const infoRows = [
      ["Fecha de emisión", formatDateStr(notice.issueDate)],
      ["Fecha de vencimiento", formatDateStr(notice.dueDate)],
      ["Período facturado", `${month} ${notice.periodYear ?? ""}`],
    ];
    let ry = colY;
    for (const [label, value] of infoRows) {
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text(label, rightColX, ry, { width: rightColW, align: "right" });
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#111827").text(value, rightColX, ry + 12, { width: rightColW, align: "right" });
      ry += 30;
    }

    let y = Math.max(ly, ry) + 15;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor("#e5e7eb").stroke();
    y += 15;

    // ── Tabla de ítem ───────────────────────────────────────────
    doc.fontSize(9).font("Helvetica").fillColor("#9ca3af")
      .text("DESCRIPCIÓN", MARGIN, y)
      .text("IMPORTE", MARGIN, y, { width: CONTENT_W, align: "right" });
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor("#e5e7eb").stroke();
    y += 12;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827")
      .text(`Hosting plan ${notice.planName ?? "—"}`, MARGIN, y);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827")
      .text(formatARS(notice.amount), MARGIN, y, { width: CONTENT_W, align: "right" });
    y += 16;
    doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
    if (notice.serviceDomain) { doc.text(`Dominio: ${notice.serviceDomain}`, MARGIN, y); y += 13; }
    doc.text(`Período: ${month} ${notice.periodYear ?? ""}`, MARGIN, y); y += 20;

    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor("#e5e7eb").stroke();
    y += 20;

    // ── Total ───────────────────────────────────────────────────
    doc.roundedRect(MARGIN, y, CONTENT_W, 55, 6).fillColor("#f3f4f6").fill();
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151").text("TOTAL A PAGAR", MARGIN + 15, y + 18);
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#4f46e5")
      .text(formatARS(notice.amount), MARGIN, y + 14, { width: CONTENT_W - 15, align: "right" });
    y += 75;

    if (notice.notes) {
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text(`Notas: ${notice.notes}`, MARGIN, y, { width: CONTENT_W });
      y += 20;
    }

    // ── Footer ───────────────────────────────────────────────────
    const footerY = Math.max(y + 20, 750);
    doc.moveTo(MARGIN, footerY).lineTo(PAGE_W - MARGIN, footerY).strokeColor("#e5e7eb").stroke();
    doc.fontSize(8).fillColor("#9ca3af").text(
      `Este aviso vence el ${formatDateStr(notice.dueDate)}. Pasada esa fecha el servicio puede ser suspendido.`,
      MARGIN, footerY + 8, { align: "center", width: CONTENT_W },
    );
    doc.fontSize(8).fillColor("#9ca3af").text(
      "Este es un comprobante electrónico generado por Bitlogic.",
      MARGIN, footerY + 20, { align: "center", width: CONTENT_W },
    );

    doc.end();
  });
}
