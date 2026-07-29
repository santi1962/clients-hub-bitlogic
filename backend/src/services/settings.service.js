import { randomUUID } from "crypto";
import pool from "../db/pool.js";

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

    const existing = await client.query("SELECT id FROM company_settings LIMIT 1");

    // UPDATE/INSERT...RETURNING -> SELECT posterior en la misma transacción
    // (mismo patrón que el resto de los dominios convertidos): mysql2 no
    // soporta RETURNING, y como acá ya conocemos el id de antemano (recién
    // generado o el existente), alcanza con un SELECT final sin necesitar
    // decidir nada por rowCount.
    let id;
    if (existing.rows.length === 0) {
      // id generado en la app (UUID v4, crypto.randomUUID) — misma política
      // que el resto de los dominios convertidos, reemplaza el uuidv4() del
      // paquete "uuid" que se usaba acá antes de esta fase.
      id = randomUUID();
      await client.query(
        `INSERT INTO company_settings (id, company_name, contact_email, phone, tax_id, address, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, companyName, contactEmail, phone, taxId, address, currency],
      );
    } else {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE company_settings
         SET company_name = ?, contact_email = ?, phone = ?, tax_id = ?, address = ?, currency = ?, updated_at = now()
         WHERE id = ?`,
        [companyName, contactEmail, phone, taxId, address, currency, id],
      );
    }
    const { rows } = await client.query("SELECT * FROM company_settings WHERE id = ?", [id]);

    await client.query("COMMIT");
    return mapSettings(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateCompanyLogo(logoUrl) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM company_settings LIMIT 1");

    // NOTA (hallazgo de esta fase, no corregido — ver docs/MARIADB_MIGRATION.md):
    // este INSERT no envía company_name, que es NOT NULL en el schema. Si se
    // sube un logo ANTES de haber guardado la configuración de empresa una
    // sola vez, esto revienta por violar el NOT NULL — en los dos motores
    // por igual. Es un bug preexistente (ya estaba así contra Postgres antes
    // de esta fase); se preserva el comportamiento tal cual para no inventar
    // un valor de company_name que nadie pidió.
    let id;
    if (existing.rows.length === 0) {
      id = randomUUID();
      await client.query(
        `INSERT INTO company_settings (id, logo_url) VALUES (?, ?)`,
        [id, logoUrl],
      );
    } else {
      id = existing.rows[0].id;
      await client.query("UPDATE company_settings SET logo_url = ?, updated_at = now() WHERE id = ?", [logoUrl, id]);
    }
    const { rows } = await client.query("SELECT * FROM company_settings WHERE id = ?", [id]);

    await client.query("COMMIT");
    return mapSettings(rows[0]);
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
    logoUrl: row.logo_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
