import pool from "../db/pool.js";

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
function formatPlan(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    storageGb: row.storage_gb,
    websitesLimit: row.websites_limit, // null = ilimitados
    emailsLimit: row.emails_limit, // null = ilimitados
    monthlyPrice: parseFloat(row.monthly_price),
    status: row.status,
    createdAt: row.created_at,
  };
}

function formatService(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    planId: row.plan_id,
    domain: row.domain,
    status: row.status, // English: active, due_soon, etc.
    monthlyPrice: parseFloat(row.monthly_price),
    setupDate: row.setup_date,
    nextDueDate: row.next_due_date,
    storageUsedGb: parseFloat(row.storage_used_gb || 0),
    storageTotalGb: parseFloat(row.storage_total_gb),
    emailsUsed: row.emails_used ?? 0,
    emailsTotal: row.emails_total, // null = ilimitados
    hestiaUsername: row.hestia_username ?? null,
    hestiaUrl: row.hestia_url ?? null,
    internalNotes: row.internal_notes ?? "",
    createdAt: row.created_at,
    // Joined from relations
    clientName: row.client_name ?? null,
    clientCompany: row.client_company ?? null,
    planName: row.plan_name ?? null,
  };
}

const SERVICE_SELECT = `
  SELECT
    hs.*,
    c.name    AS client_name,
    c.company AS client_company,
    hp.name   AS plan_name
  FROM hosting_services hs
  LEFT JOIN clients       c  ON c.id  = hs.client_id
  LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
`;

// ─────────────────────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────────────────────
export async function listPlans({ status } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM hosting_plans
     ${status ? `WHERE status = $1` : `WHERE status = 'active'`}
     ORDER BY monthly_price ASC`,
    status ? [status] : [],
  );
  return { data: rows.map(formatPlan), meta: { total: rows.length } };
}

export async function getPlanById(id) {
  const { rows } = await pool.query(`SELECT * FROM hosting_plans WHERE id = $1`, [id]);
  if (!rows[0]) {
    const e = new Error("Plan no encontrado");
    e.status = 404;
    throw e;
  }
  return formatPlan(rows[0]);
}

export async function createPlan(data) {
  const { name, description, storageGb, websitesLimit, emailsLimit, monthlyPrice } = data;
  if (!name || !storageGb || !monthlyPrice) {
    const e = new Error("name, storageGb y monthlyPrice son requeridos");
    e.status = 400;
    throw e;
  }
  const { rows } = await pool.query(
    `INSERT INTO hosting_plans (name, description, storage_gb, websites_limit, emails_limit, monthly_price)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      name,
      description ?? null,
      storageGb,
      websitesLimit ?? null,
      emailsLimit ?? null,
      monthlyPrice,
    ],
  );
  return formatPlan(rows[0]);
}

export async function updatePlan(id, data) {
  const { name, description, storageGb, websitesLimit, emailsLimit, monthlyPrice, status } = data;
  const { rows } = await pool.query(
    `UPDATE hosting_plans SET
       name            = COALESCE($2, name),
       description     = COALESCE($3, description),
       storage_gb      = COALESCE($4, storage_gb),
       websites_limit  = COALESCE($5, websites_limit),
       emails_limit    = COALESCE($6, emails_limit),
       monthly_price   = COALESCE($7, monthly_price),
       status          = COALESCE($8, status)
     WHERE id = $1 RETURNING *`,
    [
      id,
      name ?? null,
      description ?? null,
      storageGb ?? null,
      websitesLimit ?? null,
      emailsLimit ?? null,
      monthlyPrice ?? null,
      status ?? null,
    ],
  );
  if (!rows[0]) {
    const e = new Error("Plan no encontrado");
    e.status = 404;
    throw e;
  }
  return formatPlan(rows[0]);
}

// ─────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────
export async function listServices({
  clientId,
  planId,
  search,
  status,
  page = 1,
  limit = 100,
} = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (clientId) {
    conditions.push(`hs.client_id = $${idx++}`);
    params.push(clientId);
  }
  if (planId) {
    conditions.push(`hs.plan_id   = $${idx++}`);
    params.push(planId);
  }
  if (status) {
    conditions.push(`hs.status    = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(hs.domain ILIKE $${idx} OR c.company ILIKE $${idx} OR c.name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `${SERVICE_SELECT} ${where}
       ORDER BY hs.next_due_date ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FROM hosting_services hs
       LEFT JOIN clients c ON c.id = hs.client_id
       ${where}`,
      params,
    ),
  ]);

  return {
    data: dataResult.rows.map(formatService),
    meta: { page, limit, total: parseInt(countResult.rows[0].count) },
  };
}

export async function getServiceById(id) {
  const { rows } = await pool.query(`${SERVICE_SELECT} WHERE hs.id = $1`, [id]);
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
  return formatService(rows[0]);
}

export async function createService(data) {
  const {
    clientId,
    planId,
    domain,
    monthlyPrice,
    setupDate,
    nextDueDate,
    storageTotalGb,
    emailsTotal,
    hestiaUsername,
    hestiaUrl,
    internalNotes,
  } = data;

  if (
    !clientId ||
    !planId ||
    !domain ||
    !monthlyPrice ||
    !setupDate ||
    !nextDueDate ||
    !storageTotalGb
  ) {
    const e = new Error(
      "Campos requeridos: clientId, planId, domain, monthlyPrice, setupDate, nextDueDate, storageTotalGb",
    );
    e.status = 400;
    throw e;
  }

  const { rows } = await pool.query(
    `INSERT INTO hosting_services
       (client_id, plan_id, domain, monthly_price, setup_date, next_due_date,
        storage_total_gb, emails_total, hestia_username, hestia_url, internal_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      clientId,
      planId,
      domain,
      monthlyPrice,
      setupDate,
      nextDueDate,
      storageTotalGb,
      emailsTotal ?? null,
      hestiaUsername ?? null,
      hestiaUrl ?? null,
      internalNotes ?? null,
    ],
  );

  return getServiceById(rows[0].id);
}

export async function updateService(id, data) {
  const {
    planId,
    domain,
    monthlyPrice,
    setupDate,
    nextDueDate,
    status,
    storageUsedGb,
    storageTotalGb,
    emailsUsed,
    emailsTotal,
    hestiaUsername,
    hestiaUrl,
    internalNotes,
  } = data;

  const { rows } = await pool.query(
    `UPDATE hosting_services SET
       plan_id          = COALESCE($2,  plan_id),
       domain           = COALESCE($3,  domain),
       monthly_price    = COALESCE($4,  monthly_price),
       setup_date       = COALESCE($5,  setup_date),
       next_due_date    = COALESCE($6,  next_due_date),
       status           = COALESCE($7,  status),
       storage_used_gb  = COALESCE($8,  storage_used_gb),
       storage_total_gb = COALESCE($9,  storage_total_gb),
       emails_used      = COALESCE($10, emails_used),
       emails_total     = COALESCE($11, emails_total),
       hestia_username  = COALESCE($12, hestia_username),
       hestia_url       = COALESCE($13, hestia_url),
       internal_notes   = COALESCE($14, internal_notes)
     WHERE id = $1 RETURNING id`,
    [
      id,
      planId ?? null,
      domain ?? null,
      monthlyPrice ?? null,
      setupDate ?? null,
      nextDueDate ?? null,
      status ?? null,
      storageUsedGb ?? null,
      storageTotalGb ?? null,
      emailsUsed ?? null,
      emailsTotal ?? null,
      hestiaUsername ?? null,
      hestiaUrl ?? null,
      internalNotes ?? null,
    ],
  );

  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}

export async function deleteService(id) {
  const { rows } = await pool.query(`DELETE FROM hosting_services WHERE id = $1 RETURNING id`, [
    id,
  ]);
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
}

export async function suspendService(id) {
  const { rows } = await pool.query(
    `UPDATE hosting_services SET status = 'suspended' WHERE id = $1 AND status != 'suspended' RETURNING id`,
    [id],
  );
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado o ya suspendido");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}

export async function reactivateService(id) {
  const { rows } = await pool.query(
    `UPDATE hosting_services SET status = 'active' WHERE id = $1 AND status = 'suspended' RETURNING id`,
    [id],
  );
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado o no está suspendido");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}

export async function changeServicePlan(id, planId) {
  if (!planId) {
    const e = new Error("planId requerido");
    e.status = 400;
    throw e;
  }

  // Verificar que el plan existe
  await getPlanById(planId);

  // Actualizar plan y ajustar recursos según el nuevo plan
  const { rows: planRows } = await pool.query(
    `SELECT storage_gb, emails_limit FROM hosting_plans WHERE id = $1`,
    [planId],
  );
  const plan = planRows[0];

  const { rows } = await pool.query(
    `UPDATE hosting_services
     SET plan_id = $2, storage_total_gb = $3, emails_total = $4
     WHERE id = $1 RETURNING id`,
    [id, planId, plan.storage_gb, plan.emails_limit],
  );
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}
