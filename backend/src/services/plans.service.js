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
      storageGb || 0,
      websitesLimit,
      emailsLimit,
      monthlyPrice,
      status,
    ],
  );

  return mapPlan(result.rows[0]);
}

export async function updatePlan(id, data) {
  const { name, description, storageGb, websitesLimit, emailsLimit, monthlyPrice, status } = data;

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
  if (storageGb !== undefined) {
    updates.push(`storage_gb = $${paramCount++}`);
    values.push(storageGb);
  }
  if (websitesLimit !== undefined) {
    updates.push(`websites_limit = $${paramCount++}`);
    values.push(websitesLimit);
  }
  if (emailsLimit !== undefined) {
    updates.push(`emails_limit = $${paramCount++}`);
    values.push(emailsLimit);
  }
  if (monthlyPrice !== undefined) {
    updates.push(`monthly_price = $${paramCount++}`);
    values.push(monthlyPrice);
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
