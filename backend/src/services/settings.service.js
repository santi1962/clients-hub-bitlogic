import pool from "../db/pool.js";
import { v4 as uuidv4 } from "uuid";

export async function getCompanySettings() {
  const result = await pool.query("SELECT * FROM company_settings LIMIT 1");

  if (result.rows.length === 0) {
    return null;
  }

  return mapSettings(result.rows[0]);
}

export async function updateCompanySettings(data) {
  const { companyName, contactEmail, phone, taxId, address, currency } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar si ya existe configuración
    const existing = await client.query("SELECT id FROM company_settings LIMIT 1");

    let result;
    if (existing.rows.length === 0) {
      // Crear nueva configuración
      const id = uuidv4();
      result = await client.query(
        `INSERT INTO company_settings (id, company_name, contact_email, phone, tax_id, address, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, companyName, contactEmail, phone, taxId, address, currency],
      );
    } else {
      // Actualizar existente
      result = await client.query(
        `UPDATE company_settings
         SET company_name = $1, contact_email = $2, phone = $3, tax_id = $4, address = $5, currency = $6, updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [companyName, contactEmail, phone, taxId, address, currency, existing.rows[0].id],
      );
    }

    await client.query("COMMIT");
    return mapSettings(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function mapSettings(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    taxId: row.tax_id,
    address: row.address,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
