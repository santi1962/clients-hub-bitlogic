import { randomUUID } from "crypto";
import pool from "../db/pool.js";

export async function listPlans({ status, limit = 100 } = {}) {
  let query = "SELECT * FROM hosting_plans";
  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY monthly_price ASC LIMIT ?";
  params.push(limit);

  const result = await pool.query(query, params);

  return {
    data: result.rows.map(mapPlan),
    meta: { total: result.rows.length, limit },
  };
}

export async function getPlanById(id) {
  const result = await pool.query("SELECT * FROM hosting_plans WHERE id = ?", [id]);
  if (result.rows.length === 0) {
    const error = new Error("Plan no encontrado");
    error.status = 404;
    throw error;
  }
  return mapPlan(result.rows[0]);
}

export async function createPlan(data) {
  const {
    name,
    description,
    storageGb = 0,
    websitesLimit = null,
    emailsLimit = null,
    monthlyPrice,
    status = "active",
  } = data;

  if (!name || !monthlyPrice) {
    const error = new Error("El nombre y precio son requeridos");
    error.status = 400;
    throw error;
  }

  // id generado en la app (UUID v4, crypto.randomUUID) — misma política que
  // auth/users (DB-3A) y clients (DB-3B), reemplaza el uuidv4() del paquete
  // "uuid" que se usaba acá antes de esta fase.
  const id = randomUUID();
  await pool.query(
    `INSERT INTO hosting_plans
     (id, name, description, storage_gb, websites_limit, emails_limit, monthly_price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name.trim(),
      description || null,
      storageGb || 0,
      websitesLimit,
      emailsLimit,
      monthlyPrice,
      status,
    ],
  );
  const result = await pool.query("SELECT * FROM hosting_plans WHERE id = ?", [id]);

  return mapPlan(result.rows[0]);
}

export async function updatePlan(id, data) {
  const { name, description, storageGb, websitesLimit, emailsLimit, monthlyPrice, status } = data;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push(`name = ?`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = ?`);
    values.push(description || null);
  }
  if (storageGb !== undefined) {
    updates.push(`storage_gb = ?`);
    values.push(storageGb);
  }
  if (websitesLimit !== undefined) {
    updates.push(`websites_limit = ?`);
    values.push(websitesLimit);
  }
  if (emailsLimit !== undefined) {
    updates.push(`emails_limit = ?`);
    values.push(emailsLimit);
  }
  if (monthlyPrice !== undefined) {
    updates.push(`monthly_price = ?`);
    values.push(monthlyPrice);
  }
  if (status !== undefined) {
    updates.push(`status = ?`);
    values.push(status);
  }

  if (updates.length === 0) {
    return getPlanById(id);
  }

  // UPDATE...RETURNING no existe en MariaDB: UPDATE + SELECT posterior, igual
  // patrón que clients.service.js (DB-3B). El 404 se decide por el SELECT,
  // no por rowCount: mysql2 no habilita CLIENT_FOUND_ROWS, así que un PATCH
  // que no cambia ningún valor (ej. reenviar el mismo monthly_price) daría
  // rowCount=0 en MariaDB aunque el plan exista.
  values.push(id);
  await pool.query(`UPDATE hosting_plans SET ${updates.join(", ")}, updated_at = now() WHERE id = ?`, values);

  const result = await pool.query("SELECT * FROM hosting_plans WHERE id = ?", [id]);
  if (result.rows.length === 0) {
    const error = new Error("Plan no encontrado");
    error.status = 404;
    throw error;
  }

  return mapPlan(result.rows[0]);
}

export async function deletePlan(id) {
  // DELETE real (no soft-delete): a diferencia de un UPDATE con COALESCE, un
  // DELETE no tiene ambigüedad "matched pero sin cambio de valor" — rowCount
  // sigue siendo confiable en ambos motores acá, sin necesitar un SELECT
  // posterior. Si el plan tiene servicios asociados, la FK
  // hosting_services_plan_id_fkey (sin ON DELETE, por lo tanto RESTRICT)
  // rechaza el DELETE — comportamiento preexistente sin manejo especial en
  // ninguno de los dos motores (errorHandler.js no distingue el código de
  // violación de FK), no se agrega acá.
  const result = await pool.query("DELETE FROM hosting_plans WHERE id = ?", [id]);
  if (result.rowCount === 0) {
    const error = new Error("Plan no encontrado");
    error.status = 404;
    throw error;
  }
}

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    storageGb: row.storage_gb,
    websitesLimit: row.websites_limit,
    emailsLimit: row.emails_limit,
    monthlyPrice: parseFloat(row.monthly_price),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
