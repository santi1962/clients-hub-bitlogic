import { randomUUID } from "crypto";
import pool from "../db/pool.js";

const DOMAIN_SELECT = `
  d.id, d.client_id, d.hosting_service_id, d.domain, d.registrar,
  d.registration_date, d.expiration_date, d.auto_renew,
  d.annual_cost, d.customer_price,
  d.status, d.notes, d.created_at, d.updated_at,
  c.company AS client_company, c.name AS client_name,
  hs.domain AS service_domain, hp.name AS plan_name
`;

function formatDomain(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    hostingServiceId: row.hosting_service_id ?? null,
    domain: row.domain,
    registrar: row.registrar ?? null,
    registrationDate: row.registration_date ?? null,
    expirationDate: row.expiration_date,
    // auto_renew: mysql2 devuelve BOOLEAN (alias de TINYINT(1)) como 0/1, no
    // true/false — a diferencia de `pg`, que sí da un boolean nativo. !!x
    // normaliza ambos casos al mismo shape observable.
    autoRenew: !!row.auto_renew,
    // annual_cost/customer_price: antes el cast a float se hacía en SQL
    // (::float, exclusivo de Postgres). mysql2 devuelve DECIMAL como string
    // sin cast — parseFloat() en JS dda el mismo resultado en ambos motores
    // (mismo criterio que clients.service.js/hosting.service.js).
    annualCost: row.annual_cost != null ? parseFloat(row.annual_cost) : null,
    customerPrice: row.customer_price != null ? parseFloat(row.customer_price) : null,
    status: row.status,
    notes: row.notes ?? null,
    clientName: row.client_name ?? null,
    clientCompany: row.client_company ?? null,
    serviceDomain: row.service_domain ?? null,
    planName: row.plan_name ?? null,
    createdAt: row.created_at,
  };
}

export async function listDomains({
  clientId,
  serviceId,
  status,
  search,
  expiringInDays,
  page = 1,
  limit = 100,
}) {
  const conditions = [];
  const params = [];

  if (clientId) {
    conditions.push(`d.client_id = ?`);
    params.push(clientId);
  }
  if (serviceId) {
    conditions.push(`d.hosting_service_id = ?`);
    params.push(serviceId);
  }
  if (status) {
    conditions.push(`d.status = ?`);
    params.push(status);
  }
  if (search) {
    // LOWER()/LIKE en vez de ILIKE (no existe en MariaDB) — mismo criterio
    // que clients.service.js/hosting.service.js: funciona igual en ambos
    // motores con una sola query, sin depender del collation de la columna.
    conditions.push(`LOWER(d.domain) LIKE LOWER(?)`);
    params.push(`%${search}%`);
  }
  if (expiringInDays) {
    // NOW() + ($N * INTERVAL '1 day') es sintaxis exclusiva de Postgres, sin
    // equivalente parametrizable directo en MariaDB. En vez de bifurcar por
    // driver o escribir dos formas de INTERVAL, se calcula la fecha de
    // corte en Node y se pasa como parámetro simple — una comparación
    // DATE <= timestamp funciona igual en ambos motores (cast implícito de
    // la columna DATE a medianoche), sin sintaxis específica de ninguno.
    const cutoff = new Date(Date.now() + parseInt(expiringInDays, 10) * 24 * 60 * 60 * 1000);
    conditions.push(`d.expiration_date <= ? AND d.status != 'cancelled'`);
    params.push(cutoff);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${DOMAIN_SELECT} FROM domains d
       LEFT JOIN clients c ON c.id = d.client_id
       LEFT JOIN hosting_services hs ON hs.id = d.hosting_service_id
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
       ${where}
       ORDER BY d.expiration_date ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
    // default, MariaDB la nombra "COUNT(*)" literal (mismo hallazgo que
    // clients/hosting_services/audit_logs en fases anteriores).
    pool.query(`SELECT COUNT(*) AS count FROM domains d ${where}`, params),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: dataResult.rows.map(formatDomain),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getDomainById(id) {
  const { rows } = await pool.query(
    `SELECT ${DOMAIN_SELECT} FROM domains d
     LEFT JOIN clients c ON c.id = d.client_id
     LEFT JOIN hosting_services hs ON hs.id = d.hosting_service_id
     LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
     WHERE d.id = ?`,
    [id],
  );
  return rows[0] ? formatDomain(rows[0]) : null;
}

export async function createDomain(data) {
  // id generado en la app (UUID v4, crypto.randomUUID) — misma política que
  // clients/hosting_plans/hosting_services/audit_logs. A diferencia de esos
  // dominios, acá el DEFAULT (UUID()) de domains.id NO se retira del schema
  // en esta fase: seeds/004_domains_seed.js (demo, fuera de alcance) todavía
  // inserta sin id explícito y depende de ese default — mismo caso que
  // users.id en la Fase DB-3A.
  const id = randomUUID();
  await pool.query(
    `INSERT INTO domains (id, client_id, hosting_service_id, domain, registrar, registration_date, expiration_date, annual_cost, customer_price, notes, auto_renew)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.clientId,
      data.hostingServiceId ?? null,
      data.domain,
      data.registrar ?? null,
      data.registrationDate ?? null,
      data.expirationDate,
      data.annualCost ?? null,
      data.customerPrice ?? null,
      data.notes ?? null,
      data.autoRenew ?? false,
    ],
  );
  return getDomainById(id);
}

export async function updateDomain(id, patch) {
  const updates = [];
  const params = [];

  if (patch.registrar !== undefined) {
    updates.push(`registrar = ?`);
    params.push(patch.registrar);
  }
  if (patch.expirationDate !== undefined) {
    updates.push(`expiration_date = ?`);
    params.push(patch.expirationDate);
  }
  if (patch.autoRenew !== undefined) {
    updates.push(`auto_renew = ?`);
    params.push(patch.autoRenew);
  }
  if (patch.annualCost !== undefined) {
    updates.push(`annual_cost = ?`);
    params.push(patch.annualCost);
  }
  if (patch.customerPrice !== undefined) {
    updates.push(`customer_price = ?`);
    params.push(patch.customerPrice);
  }
  if (patch.status !== undefined) {
    updates.push(`status = ?`);
    params.push(patch.status);
  }
  if (patch.notes !== undefined) {
    updates.push(`notes = ?`);
    params.push(patch.notes);
  }

  if (updates.length === 0) return getDomainById(id);

  params.push(id);
  await pool.query(`UPDATE domains SET ${updates.join(", ")} WHERE id = ?`, params);

  return getDomainById(id);
}

export async function softDeleteDomain(id) {
  return updateDomain(id, { status: "cancelled" });
}

export async function renewDomain(id, data) {
  const updates = { status: "active", expirationDate: data.newExpirationDate };
  if (data.annualCost !== undefined) updates.annualCost = data.annualCost;
  if (data.customerPrice !== undefined) updates.customerPrice = data.customerPrice;
  if (data.notes !== undefined) updates.notes = data.notes;

  return updateDomain(id, updates);
}
