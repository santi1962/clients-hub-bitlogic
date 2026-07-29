import { randomUUID } from "crypto";
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
    storageTotalGb: parseFloat(row.plan_storage_gb ?? row.storage_total_gb),
    emailsUsed: row.emails_used ?? 0,
    emailsTotal: row.plan_emails_limit ?? null, // null = ilimitados
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
    c.name         AS client_name,
    c.company      AS client_company,
    hp.name        AS plan_name,
    hp.storage_gb  AS plan_storage_gb,
    hp.emails_limit AS plan_emails_limit
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
     ${status ? `WHERE status = ?` : `WHERE status = 'active'`}
     ORDER BY monthly_price ASC`,
    status ? [status] : [],
  );
  return { data: rows.map(formatPlan), meta: { total: rows.length } };
}

export async function getPlanById(id) {
  const { rows } = await pool.query(`SELECT * FROM hosting_plans WHERE id = ?`, [id]);
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
  // id generado en la app — misma política que plans.service.js (dominio
  // hermano, mismo default (UUID()) retirado del schema en esta fase).
  const id = randomUUID();
  await pool.query(
    `INSERT INTO hosting_plans (id, name, description, storage_gb, websites_limit, emails_limit, monthly_price)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      name,
      description ?? null,
      storageGb,
      websitesLimit ?? null,
      emailsLimit ?? null,
      monthlyPrice,
    ],
  );
  const { rows } = await pool.query(`SELECT * FROM hosting_plans WHERE id = ?`, [id]);
  return formatPlan(rows[0]);
}

export async function updatePlan(id, data) {
  const { name, description, storageGb, websitesLimit, emailsLimit, monthlyPrice, status } = data;
  // UPDATE...RETURNING -> UPDATE + SELECT (ver nota en plans.service.js: el
  // 404 se decide por el SELECT, no por rowCount, porque un COALESCE que no
  // cambia ningún valor da rowCount=0 en MariaDB aunque la fila exista).
  await pool.query(
    `UPDATE hosting_plans SET
       name            = COALESCE(?, name),
       description     = COALESCE(?, description),
       storage_gb      = COALESCE(?, storage_gb),
       websites_limit  = COALESCE(?, websites_limit),
       emails_limit    = COALESCE(?, emails_limit),
       monthly_price   = COALESCE(?, monthly_price),
       status          = COALESCE(?, status)
     WHERE id = ?`,
    [
      name ?? null,
      description ?? null,
      storageGb ?? null,
      websitesLimit ?? null,
      emailsLimit ?? null,
      monthlyPrice ?? null,
      status ?? null,
      id,
    ],
  );
  const { rows } = await pool.query(`SELECT * FROM hosting_plans WHERE id = ?`, [id]);
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

  if (clientId) {
    conditions.push(`hs.client_id = ?`);
    params.push(clientId);
  }
  if (planId) {
    conditions.push(`hs.plan_id   = ?`);
    params.push(planId);
  }
  if (status) {
    conditions.push(`hs.status    = ?`);
    params.push(status);
  }
  if (search) {
    // LOWER()/LIKE en vez de ILIKE (no existe en MariaDB) — misma técnica
    // que clients.service.js (DB-3B): funciona igual en ambos motores sin
    // depender del collation de la columna.
    conditions.push(`(LOWER(hs.domain) LIKE LOWER(?) OR LOWER(c.company) LIKE LOWER(?) OR LOWER(c.name) LIKE LOWER(?))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `${SERVICE_SELECT} ${where}
       ORDER BY hs.next_due_date ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
    // default, MariaDB la nombra "COUNT(*)" literal (mismo hallazgo que
    // clients.service.js en DB-3B).
    pool.query(
      `SELECT COUNT(*) AS count FROM hosting_services hs
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
  const { rows } = await pool.query(`${SERVICE_SELECT} WHERE hs.id = ?`, [id]);
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
    hestiaUsername,
    hestiaUrl,
    internalNotes,
  } = data;

  if (!clientId || !planId || !domain || !monthlyPrice || !setupDate || !nextDueDate) {
    const e = new Error(
      "Campos requeridos: clientId, planId, domain, monthlyPrice, setupDate, nextDueDate",
    );
    e.status = 400;
    throw e;
  }

  // Tomar storage y emails del plan para que los totales siempre reflejen el plan
  const { rows: planRows } = await pool.query(
    `SELECT storage_gb, emails_limit FROM hosting_plans WHERE id = ?`,
    [planId],
  );
  if (!planRows[0]) {
    const e = new Error("Plan no encontrado");
    e.status = 400;
    throw e;
  }
  const { storage_gb, emails_limit } = planRows[0];

  // id generado en la app — misma política que clients/plans: el
  // DEFAULT (UUID()) de hosting_services.id se retira en esta fase.
  const id = randomUUID();
  await pool.query(
    `INSERT INTO hosting_services
       (id, client_id, plan_id, domain, monthly_price, setup_date, next_due_date,
        storage_total_gb, emails_total, hestia_username, hestia_url, internal_notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      clientId,
      planId,
      domain,
      monthlyPrice,
      setupDate,
      nextDueDate,
      storage_gb,
      emails_limit ?? null,
      hestiaUsername ?? null,
      hestiaUrl ?? null,
      internalNotes ?? null,
    ],
  );

  return getServiceById(id);
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

  // UPDATE...RETURNING -> UPDATE + SELECT posterior. A diferencia de
  // suspendService/reactivateService (abajo), acá el WHERE no excluye
  // ningún estado previo — un PATCH que reenvía exactamente los mismos
  // valores que ya tiene el servicio (ej. repetir el mismo status) no
  // cambiaría ningún valor, y en MariaDB eso da rowCount=0 aunque la fila
  // exista. El 404 se decide confirmando con getServiceById, no con rowCount
  // (mismo criterio que updateClient/softDeleteClient en clients.service.js,
  // DB-3B).
  await pool.query(
    `UPDATE hosting_services SET
       plan_id          = COALESCE(?, plan_id),
       domain           = COALESCE(?, domain),
       monthly_price    = COALESCE(?, monthly_price),
       setup_date       = COALESCE(?, setup_date),
       next_due_date    = COALESCE(?, next_due_date),
       status           = COALESCE(?, status),
       storage_used_gb  = COALESCE(?, storage_used_gb),
       storage_total_gb = COALESCE(?, storage_total_gb),
       emails_used      = COALESCE(?, emails_used),
       emails_total     = COALESCE(?, emails_total),
       hestia_username  = COALESCE(?, hestia_username),
       hestia_url       = COALESCE(?, hestia_url),
       internal_notes   = COALESCE(?, internal_notes)
     WHERE id = ?`,
    [
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
      id,
    ],
  );

  const { rows } = await pool.query(`SELECT id FROM hosting_services WHERE id = ?`, [id]);
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}

export async function deleteService(id) {
  // Hard delete real (no soft-delete): igual que deletePlan en
  // plans.service.js, un DELETE no tiene el problema de "matched pero sin
  // cambio de valor" — rowCount sigue siendo confiable en ambos motores acá.
  const { rowCount } = await pool.query(`DELETE FROM hosting_services WHERE id = ?`, [id]);
  if (rowCount === 0) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
}

export async function suspendService(id) {
  // El WHERE excluye explícitamente el estado ya-suspendido: cuando matchea,
  // el UPDATE SIEMPRE cambia el valor de status (de cualquier otro estado a
  // 'suspended') — a diferencia de updateService, acá rowCount sigue siendo
  // seguro en ambos motores, no hace falta el patrón SELECT posterior.
  const { rowCount } = await pool.query(
    `UPDATE hosting_services SET status = 'suspended' WHERE id = ? AND status != 'suspended'`,
    [id],
  );
  if (rowCount === 0) {
    const e = new Error("Servicio no encontrado o ya suspendido");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}

export async function reactivateService(id) {
  // Mismo razonamiento que suspendService: el WHERE exige status='suspended'
  // y el SET lo cambia a 'active' — siempre hay un cambio real de valor
  // cuando el WHERE matchea, rowCount es seguro en ambos motores.
  const { rowCount } = await pool.query(
    `UPDATE hosting_services SET status = 'active' WHERE id = ? AND status = 'suspended'`,
    [id],
  );
  if (rowCount === 0) {
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

  // Actualizar plan y ajustar recursos y precio según el nuevo plan
  const { rows: planRows } = await pool.query(
    `SELECT storage_gb, emails_limit, monthly_price FROM hosting_plans WHERE id = ?`,
    [planId],
  );
  const plan = planRows[0];

  // UPDATE...RETURNING -> UPDATE + SELECT posterior. Reasignar el MISMO plan
  // que el servicio ya tenía no cambia ningún valor (plan_id/storage_total_gb/
  // emails_total/monthly_price quedan iguales) — en MariaDB eso da rowCount=0
  // aunque el servicio exista, mismo riesgo que updateService arriba. El 404
  // se decide confirmando con un SELECT, no con rowCount.
  await pool.query(
    `UPDATE hosting_services
     SET plan_id = ?, storage_total_gb = ?, emails_total = ?, monthly_price = ?
     WHERE id = ?`,
    [planId, plan.storage_gb, plan.emails_limit, plan.monthly_price, id],
  );
  const { rows } = await pool.query(`SELECT id FROM hosting_services WHERE id = ?`, [id]);
  if (!rows[0]) {
    const e = new Error("Servicio no encontrado");
    e.status = 404;
    throw e;
  }
  return getServiceById(id);
}
