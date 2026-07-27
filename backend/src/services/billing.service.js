import pool from "../db/pool.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";
import { getCompanySettings } from "./settings.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  let idx = 1;

  if (clientId) {
    conditions.push(`pn.client_id = $${idx++}`);
    params.push(clientId);
  }
  if (serviceId) {
    conditions.push(`pn.hosting_service_id = $${idx++}`);
    params.push(serviceId);
  }
  if (status) {
    conditions.push(`pn.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(
      `(c.company ILIKE $${idx} OR c.name ILIKE $${idx} OR hs.domain ILIKE $${idx} OR pn.notice_number ILIKE $${idx})`,
    );
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `${NOTICE_SELECT} ${where} ORDER BY pn.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FROM payment_notices pn
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
  const { rows } = await pool.query(`${NOTICE_SELECT} WHERE pn.id = $1`, [id]);
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
    const { rows } = await pool.query(`SELECT monthly_price FROM hosting_services WHERE id = $1`, [
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
  } = await pool.query(`SELECT NEXTVAL('payment_notice_number_seq') AS n`);
  const noticeNumber = `AV-${periodYear}-${String(seqRow.n).padStart(4, "0")}`;

  const { rows } = await pool.query(
    `INSERT INTO payment_notices (client_id, hosting_service_id, notice_number, period_month, period_year, due_date, amount, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING id`,
    [
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

  return getNoticeById(rows[0].id);
}

export async function updateNotice(id, data) {
  const { dueDate, amount, notes, status } = data;
  const { rows } = await pool.query(
    `UPDATE payment_notices SET
       due_date = COALESCE($2, due_date),
       amount   = COALESCE($3, amount),
       notes    = COALESCE($4, notes),
       status   = COALESCE($5, status)
     WHERE id = $1 RETURNING id`,
    [id, dueDate ?? null, amount ?? null, notes ?? null, status ?? null],
  );
  if (!rows[0]) {
    const e = new Error("Aviso no encontrado");
    e.status = 404;
    throw e;
  }
  return getNoticeById(id);
}

export async function sendNotice(id) {
  const { rows } = await pool.query(
    `UPDATE payment_notices SET status = 'sent', sent_at = now()
     WHERE id = $1 AND status IN ('draft','pending') RETURNING id`,
    [id],
  );
  if (!rows[0]) {
    const e = new Error("Aviso no encontrado o no está en estado enviable");
    e.status = 404;
    throw e;
  }
  return getNoticeById(id);
}

export async function cancelNotice(id) {
  const { rows } = await pool.query(
    `UPDATE payment_notices SET status = 'cancelled'
     WHERE id = $1 AND status NOT IN ('paid','cancelled') RETURNING id`,
    [id],
  );
  if (!rows[0]) {
    const e = new Error("Aviso no encontrado o no se puede cancelar");
    e.status = 404;
    throw e;
  }
  return getNoticeById(id);
}

export async function deleteNotice(id) {
  const { rows } = await pool.query(
    `DELETE FROM payment_notices WHERE id = $1 AND status != 'paid' RETURNING id`,
    [id],
  );
  if (!rows[0]) {
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
  let idx = 1;

  if (clientId) {
    conditions.push(`p.client_id = $${idx++}`);
    params.push(clientId);
  }
  if (serviceId) {
    conditions.push(`p.hosting_service_id = $${idx++}`);
    params.push(serviceId);
  }
  if (status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(status);
  }
  if (method) {
    conditions.push(`p.method = $${idx++}`);
    params.push(method);
  }
  if (periodMonth) {
    conditions.push(`p.period_month = $${idx++}`);
    params.push(parseInt(periodMonth));
  }
  if (periodYear) {
    conditions.push(`p.period_year = $${idx++}`);
    params.push(parseInt(periodYear));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `${PAYMENT_SELECT} ${where} ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM payments p ${where}`, params),
  ]);

  return {
    data: dataRes.rows.map(formatPayment),
    meta: { page, limit, total: parseInt(countRes.rows[0].count) },
  };
}

export async function getPaymentById(id) {
  const { rows } = await pool.query(`${PAYMENT_SELECT} WHERE p.id = $1`, [id]);
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
    const { rows } = await client.query(
      `INSERT INTO payments (client_id, hosting_service_id, payment_notice_id, period_month, period_year, amount, method, status, paid_at, reference, internal_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
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
      await client.query(`UPDATE payment_notices SET status = 'paid', paid_at = $2 WHERE id = $1`, [
        paymentNoticeId,
        paidAt,
      ]);
    }

    await client.query("COMMIT");
    return getPaymentById(rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePayment(id, data) {
  const { amount, method, status, paidAt, reference, internalNotes } = data;
  const { rows } = await pool.query(
    `UPDATE payments SET
       amount         = COALESCE($2, amount),
       method         = COALESCE($3, method),
       status         = COALESCE($4, status),
       paid_at        = COALESCE($5, paid_at),
       reference      = COALESCE($6, reference),
       internal_notes = COALESCE($7, internal_notes)
     WHERE id = $1 RETURNING id`,
    [
      id,
      amount ?? null,
      method ?? null,
      status ?? null,
      paidAt ?? null,
      reference ?? null,
      internalNotes ?? null,
    ],
  );
  if (!rows[0]) {
    const e = new Error("Pago no encontrado");
    e.status = 404;
    throw e;
  }
  return getPaymentById(id);
}

export async function markPaid(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE payments SET status = 'paid', paid_at = now() WHERE id = $1 AND status != 'paid' RETURNING *`,
      [id],
    );
    if (!rows[0]) {
      const e = new Error("Pago no encontrado o ya está pagado");
      e.status = 404;
      throw e;
    }

    // Marcar aviso relacionado si existe
    if (rows[0].payment_notice_id) {
      await client.query(
        `UPDATE payment_notices SET status = 'paid', paid_at = now() WHERE id = $1`,
        [rows[0].payment_notice_id],
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`DELETE FROM payments WHERE id = $1 RETURNING *`, [id]);
    if (!rows[0]) {
      const e = new Error("Pago no encontrado");
      e.status = 404;
      throw e;
    }

    // Revertir aviso relacionado si quedó marcado como pagado por este pago
    if (rows[0].payment_notice_id && rows[0].status === "paid") {
      await client.query(
        `UPDATE payment_notices SET status = 'pending', paid_at = NULL WHERE id = $1 AND status = 'paid'`,
        [rows[0].payment_notice_id],
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
  const [paymentRow, noticeRow, serviceRow] = await Promise.all([
    pool.query(
      `
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),    0) AS total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending,
        COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) AS total_overdue,
        MAX(paid_at) FILTER (WHERE status = 'paid')               AS last_payment_date
      FROM payments WHERE client_id = $1
    `,
      [clientId],
    ),
    pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','sent'))  AS notices_pending,
        COUNT(*) FILTER (WHERE status = 'overdue')            AS notices_overdue
      FROM payment_notices WHERE client_id = $1
    `,
      [clientId],
    ),
    pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled','suspended')) AS services_count,
        MIN(next_due_date) FILTER (WHERE status NOT IN ('cancelled','suspended')) AS next_due_date
      FROM hosting_services WHERE client_id = $1
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
  const [revenueRow, paymentsRow, noticeCountRow, revenueMonths, planDist, overduePayments] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(monthly_price),0) AS monthly FROM hosting_services WHERE status NOT IN ('cancelled','suspended')`,
      ),
      pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status='paid' AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)), 0) AS collected_this_month,
        COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0) AS pending_total,
        COALESCE(SUM(amount) FILTER (WHERE status='overdue'),  0) AS overdue_total
      FROM payments
    `),
      pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','sent')) AS pending_count,
        COUNT(*) FILTER (WHERE status='overdue')             AS overdue_count
      FROM payment_notices
    `),
      pool.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS ms
      )
      SELECT
        EXTRACT(MONTH FROM m.ms)::int AS month,
        EXTRACT(YEAR  FROM m.ms)::int AS year,
        COALESCE(SUM(p.amount), 0)::numeric AS total
      FROM months m
      LEFT JOIN payments p ON date_trunc('month', p.paid_at) = m.ms AND p.status = 'paid'
      GROUP BY m.ms ORDER BY m.ms
    `),
      pool.query(`
      SELECT hp.name, COUNT(hs.id)::int AS value
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

  return {
    monthly,
    annualProjection: monthly * 12,
    collectedThisMonth,
    pending: parseFloat(pr.pending_total),
    debt: parseFloat(pr.overdue_total),
    pendingNoticesCount: parseInt(nc.pending_count),
    overdueNoticesCount: parseInt(nc.overdue_count),
    revenueLast12Months: revenueMonths.rows.map((r) => ({
      month: r.month,
      year: r.year,
      total: parseFloat(r.total),
    })),
    paidVsPending: [
      { name: "Cobrado", value: collectedThisMonth },
      { name: "Pendiente", value: parseFloat(pr.pending_total) },
      { name: "Vencido", value: parseFloat(pr.overdue_total) },
    ],
    planDistribution: planDist.rows,
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
