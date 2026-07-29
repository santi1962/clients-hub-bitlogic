import { randomUUID } from "crypto";
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
    lastPaymentDate: row.last_payment_date ? new Date(row.last_payment_date).toISOString() : null,
  };
}

/** Construye WHERE dinámico evitando inyección SQL. */
function buildWhere(conditions, params) {
  return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
}

export async function listClients({ search, status, page = 1, limit = 100 } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    // LOWER(...) LIKE LOWER(?) en vez de ILIKE: ILIKE no existe en MariaDB, y
    // reemplazarlo por un LIKE plano hubiera dependido del collation de la
    // columna (case-insensitive por default en este schema, pero no
    // garantizado). LOWER()/LOWER() da el mismo resultado case-insensitive en
    // ambos motores con una única query, sin bifurcar por driver.
    conditions.push(`(LOWER(c.name) LIKE LOWER(?) OR LOWER(c.company) LIKE LOWER(?) OR LOWER(c.email) LIKE LOWER(?))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    conditions.push(`c.status = ?`);
    params.push(status);
  }

  const where = buildWhere(conditions, params);
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         c.*,
         COUNT(CASE WHEN hs.status NOT IN ('cancelled','suspended') THEN hs.id END) AS services_count,
         MIN(CASE WHEN hs.status NOT IN ('cancelled','suspended') THEN hs.next_due_date END) AS next_due_date,
         (SELECT MAX(p.paid_at) FROM payments p WHERE p.client_id = c.id AND p.status = 'paid') AS last_payment_date
       FROM clients c
       LEFT JOIN hosting_services hs ON hs.client_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
    // default, pero MariaDB nombra la columna "COUNT(*)" literal — sin el
    // alias, countResult.rows[0].count sería undefined contra MariaDB.
    pool.query(`SELECT COUNT(*) AS count FROM clients c ${where}`, params),
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
       COUNT(CASE WHEN hs.status NOT IN ('cancelled','suspended') THEN hs.id END) AS services_count,
       MIN(CASE WHEN hs.status NOT IN ('cancelled','suspended') THEN hs.next_due_date END) AS next_due_date
     FROM clients c
     LEFT JOIN hosting_services hs ON hs.client_id = c.id
     WHERE c.id = ?
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

  // id generado en la app (UUID v4, crypto.randomUUID) — mismo criterio que
  // auth/users (Fase DB-3A): el DEFAULT (UUID()) de la columna genera UUID
  // v1 en MariaDB, no v4. INSERT sin RETURNING + SELECT posterior por id,
  // igual patrón que createPortalUser en users.service.js.
  const id = randomUUID();
  await pool.query(
    `INSERT INTO clients (id, name, company, email, phone, tax_id, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      id,
      name.trim(),
      company?.trim() ?? null,
      email.toLowerCase().trim(),
      phone?.trim() ?? null,
      taxId?.trim() ?? null,
      notes?.trim() ?? null,
    ],
  );
  const { rows } = await pool.query(`SELECT * FROM clients WHERE id = ?`, [id]);

  return formatClient({ ...rows[0], services_count: 0, next_due_date: null });
}

export async function updateClient(id, data) {
  const { name, company, email, phone, taxId, status, notes } = data;

  // UPDATE...RETURNING no existe en MariaDB: UPDATE + SELECT posterior, igual
  // que auth/users. A diferencia de resetPassword (que sí puede confiar en
  // rowCount porque `updated_at = now()` siempre cambia), acá el 404 se
  // decide por la ausencia de fila en el SELECT y no por rowCount de la
  // UPDATE: mysql2 no habilita CLIENT_FOUND_ROWS, así que en MariaDB una
  // UPDATE cuyo COALESCE no cambia ningún valor (ej. PATCH que repite el
  // status actual) reporta rowCount=0 aunque el cliente exista — con
  // Postgres ese mismo caso da rowCount=1 siempre que el id matchee. Contar
  // con rowCount para el 404 rompería ese caso solo en MariaDB.
  await pool.query(
    `UPDATE clients
     SET
       name       = COALESCE(?, name),
       company    = COALESCE(?, company),
       email      = COALESCE(?, email),
       phone      = COALESCE(?, phone),
       tax_id     = COALESCE(?, tax_id),
       status     = COALESCE(?, status),
       notes      = COALESCE(?, notes)
     WHERE id = ?`,
    [
      name?.trim() ?? null,
      company?.trim() ?? null,
      email?.toLowerCase().trim() ?? null,
      phone?.trim() ?? null,
      taxId?.trim() ?? null,
      status ?? null,
      notes ?? null,
      id,
    ],
  );

  const { rows } = await pool.query(`SELECT * FROM clients WHERE id = ?`, [id]);
  if (!rows[0]) {
    const err = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return formatClient({ ...rows[0], services_count: 0, next_due_date: null });
}

/** Soft delete: cambia status a 'inactive'. No borra registros. */
export async function softDeleteClient(id) {
  // Mismo motivo que updateClient: no depender de rowCount de la UPDATE para
  // el 404 (soft-delete es idempotente — repetirlo sobre un cliente ya
  // inactive no cambia ningún valor, y en MariaDB eso da rowCount=0 aunque
  // el cliente exista). El SELECT posterior confirma existencia real.
  await pool.query(`UPDATE clients SET status = 'inactive' WHERE id = ?`, [id]);

  const { rows } = await pool.query(`SELECT id FROM clients WHERE id = ?`, [id]);
  if (!rows[0]) {
    const err = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return { id };
}
