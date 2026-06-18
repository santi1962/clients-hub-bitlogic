import pool from "../db/pool.js";
import { v4 as uuidv4 } from "uuid";

export async function listPlans({ status, limit = 100 } = {}) {
  let query = "SELECT * FROM hosting_plans";
  const params = [];

  if (status) {
    query += " WHERE status = $1";
    params.push(status);
  }

  query += " ORDER BY monthly_price ASC LIMIT $" + (params.length + 1);
  params.push(limit);

  const result = await pool.query(query, params);

  return {
    data: result.rows.map(mapPlan),
    meta: { total: result.rows.length, limit },
  };
}

export async function getPlanById(id) {
  const result = await pool.query("SELECT * FROM hosting_plans WHERE id = $1", [id]);
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
    storage_gb = 0,
    websites_limit = null,
    emails_limit = null,
    monthly_price,
    status = "active",
  } = data;

  if (!name || !monthly_price) {
    const error = new Error("El nombre y precio son requeridos");
    error.status = 400;
    throw error;
  }

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO hosting_plans
     (id, name, description, storage_gb, websites_limit, emails_limit, monthly_price, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      name.trim(),
      description || null,
      storage_gb || 0,
      websites_limit,
      emails_limit,
      monthly_price,
      status,
    ],
  );

  return mapPlan(result.rows[0]);
}

export async function updatePlan(id, data) {
  const { name, description, storage_gb, websites_limit, emails_limit, monthly_price, status } =
    data;

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description || null);
  }
  if (storage_gb !== undefined) {
    updates.push(`storage_gb = $${paramCount++}`);
    values.push(storage_gb);
  }
  if (websites_limit !== undefined) {
    updates.push(`websites_limit = $${paramCount++}`);
    values.push(websites_limit);
  }
  if (emails_limit !== undefined) {
    updates.push(`emails_limit = $${paramCount++}`);
    values.push(emails_limit);
  }
  if (monthly_price !== undefined) {
    updates.push(`monthly_price = $${paramCount++}`);
    values.push(monthly_price);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(status);
  }

  if (updates.length === 0) {
    return getPlanById(id);
  }

  updates.push("updated_at = now()");
  values.push(id);

  const result = await pool.query(
    `UPDATE hosting_plans SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    const error = new Error("Plan no encontrado");
    error.status = 404;
    throw error;
  }

  return mapPlan(result.rows[0]);
}

export async function deletePlan(id) {
  const result = await pool.query("DELETE FROM hosting_plans WHERE id = $1", [id]);
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
