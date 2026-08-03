import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import config from "../config/index.js";

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

    // Bug preexistente corregido en la Fase de cierre pre-deploy: antes esto
    // insertaba una fila sin company_name (NOT NULL en el schema) cuando
    // todavía no existía configuración de empresa, y reventaba con un 500
    // genérico. Ahora no se inventa un company_name — se rechaza con un
    // error funcional claro (409, mismo formato que el resto de la app vía
    // errorHandler) pidiendo guardar los datos básicos de empresa primero.
    if (existing.rows.length === 0) {
      const err = new Error(
        "Todavía no se guardó la configuración de la empresa. Guardá el nombre y los datos básicos antes de subir un logo.",
      );
      err.status = 409;
      err.code = "COMPANY_SETTINGS_NOT_FOUND";
      throw err;
    }

    const id = existing.rows[0].id;
    await client.query("UPDATE company_settings SET logo_url = ?, updated_at = now() WHERE id = ?", [logoUrl, id]);
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

/**
 * Sin fila guardada todavía: devuelve el default derivado de las env vars
 * reales (HESTIA_API_URL) en vez de un placeholder hardcodeado, para que la
 * pantalla de Configuración → Hosting arranque mostrando el server real.
 */
export async function getHostingSettings() {
  const result = await pool.query("SELECT * FROM hosting_settings LIMIT 1");

  if (result.rows.length === 0) {
    const hestiaUrl = config.hestia.url || "";
    return {
      id: null,
      hestiaUrl,
      mainServer: hestiaUrl ? hestiaUrl.replace(/^https?:\/\//, "").replace(/:\d+$/, "") : "",
      serverIp: "",
      defaultQuotaGb: 5,
      defaultEmails: 10,
      spaceAlertsEnabled: true,
      createdAt: null,
      updatedAt: null,
    };
  }

  return mapHostingSettings(result.rows[0]);
}

export async function updateHostingSettings(data) {
  const {
    hestiaUrl,
    mainServer,
    serverIp,
    defaultQuotaGb,
    defaultEmails,
    spaceAlertsEnabled,
  } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM hosting_settings LIMIT 1");

    let id;
    if (existing.rows.length === 0) {
      id = randomUUID();
      await client.query(
        `INSERT INTO hosting_settings (id, hestia_url, main_server, server_ip, default_quota_gb, default_emails, space_alerts_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, hestiaUrl, mainServer, serverIp, defaultQuotaGb, defaultEmails, spaceAlertsEnabled ? 1 : 0],
      );
    } else {
      id = existing.rows[0].id;
      await client.query(
        `UPDATE hosting_settings
         SET hestia_url = ?, main_server = ?, server_ip = ?, default_quota_gb = ?, default_emails = ?, space_alerts_enabled = ?, updated_at = now()
         WHERE id = ?`,
        [hestiaUrl, mainServer, serverIp, defaultQuotaGb, defaultEmails, spaceAlertsEnabled ? 1 : 0, id],
      );
    }
    const { rows } = await client.query("SELECT * FROM hosting_settings WHERE id = ?", [id]);

    await client.query("COMMIT");
    return mapHostingSettings(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function mapHostingSettings(row) {
  return {
    id: row.id,
    hestiaUrl: row.hestia_url ?? "",
    mainServer: row.main_server ?? "",
    serverIp: row.server_ip ?? "",
    defaultQuotaGb: row.default_quota_gb,
    defaultEmails: row.default_emails,
    spaceAlertsEnabled: !!row.space_alerts_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
