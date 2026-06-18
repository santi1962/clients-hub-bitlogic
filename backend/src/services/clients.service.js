import pool from "../db/pool.js";

function formatClient(row) {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? "",
    email: row.email,
    phone: row.phone ?? "",
    taxId: row.tax_id ?? null,
    status: row.status, // 'active' | 'inactive'
    notes: row.notes ?? "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    servicesCount: parseInt(row.services_count ?? 0),
    nextDueDate: row.next_due_date ? new Date(row.next_due_date).toISOString() : null,
  };
}

/** Construye WHERE dinámico evitando inyección SQL. */
function buildWhere(conditions, params) {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

export async function listClients({ search, status, page = 1, limit = 100 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(c.name ILIKE $${idx} OR c.company ILIKE $${idx} OR c.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (status) {
    conditions.push(`c.status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = buildWhere(conditions, params);
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         c.*,
         COUNT(hs.id) FILTER (WHERE hs.status NOT IN ('cancelled','suspended')) AS services_count,
         MIN(hs.next_due_date)             FILTER (WHERE hs.status NOT IN ('cancelled','suspended')) AS next_due_date
       FROM clients c
       LEFT JOIN hosting_services hs ON hs.client_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM clients c ${where}`, params),
  ]);

  return {
    data: dataResult.rows.map(formatClient),
    meta: { page, limit, total: parseInt(countResult.rows[0].count) },
  };
}

export async function getClientById(id) {
  const { rows } = await pool.query(
    `SELECT
       c.*,
       COUNT(hs.id) FILTER (WHERE hs.status NOT IN ('cancelled','suspended')) AS services_count,
       MIN(hs.next_due_date) FILTER (WHERE hs.status NOT IN ('cancelled','suspended')) AS next_due_date
     FROM clients c
     LEFT JOIN hosting_services hs ON hs.client_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id],
  );

  const row = rows[0];
  if (!row) {
    const err = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return formatClient(row);
}

export async function createClient(data) {
  const { name, company, email, phone, taxId, notes } = data;

  if (!name || !email) {
    const err = new Error("Nombre y email son requeridos");
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO clients (name, company, email, phone, tax_id, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,'active')
     RETURNING *`,
    [
      name.trim(),
      company?.trim() ?? null,
      email.toLowerCase().trim(),
      phone?.trim() ?? null,
      taxId?.trim() ?? null,
      notes?.trim() ?? null,
    ],
  );

  return formatClient({ ...rows[0], services_count: 0, next_due_date: null });
}

export async function updateClient(id, data) {
  const { name, company, email, phone, taxId, status, notes } = data;

  const { rows } = await pool.query(
    `UPDATE clients
     SET
       name       = COALESCE($2, name),
       company    = COALESCE($3, company),
       email      = COALESCE($4, email),
       phone      = COALESCE($5, phone),
       tax_id     = COALESCE($6, tax_id),
       status     = COALESCE($7, status),
       notes      = COALESCE($8, notes)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      name?.trim() ?? null,
      company?.trim() ?? null,
      email?.toLowerCase().trim() ?? null,
      phone?.trim() ?? null,
      taxId?.trim() ?? null,
      status ?? null,
      notes ?? null,
    ],
  );

  if (!rows[0]) {
    const err = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return formatClient({ ...rows[0], services_count: 0, next_due_date: null });
}

/** Soft delete: cambia status a 'inactive'. No borra registros. */
export async function softDeleteClient(id) {
  const { rows } = await pool.query(
    `UPDATE clients SET status = 'inactive' WHERE id = $1 RETURNING id`,
    [id],
  );
  if (!rows[0]) {
    const err = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return { id };
}
