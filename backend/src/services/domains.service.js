import pool from "../db/pool.js";

const DOMAIN_SELECT = `
  d.id, d.client_id, d.hosting_service_id, d.domain, d.registrar,
  d.registration_date, d.expiration_date, d.auto_renew,
  d.annual_cost::float, d.customer_price::float,
  d.status, d.notes, d.created_at, d.updated_at,
  c.company AS client_company, c.name AS client_name,
  hs.domain AS service_domain, hp.name AS plan_name
`;

export async function listDomains({
  clientId,
  serviceId,
  status,
  search,
  expiringInDays,
  page = 1,
  limit = 100,
}) {
  const client = await pool.connect();
  try {
    let query = `SELECT ${DOMAIN_SELECT} FROM domains d
                 LEFT JOIN clients c ON c.id = d.client_id
                 LEFT JOIN hosting_services hs ON hs.id = d.hosting_service_id
                 LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (clientId) {
      query += ` AND d.client_id = $${paramCount}`;
      params.push(clientId);
      paramCount++;
    }
    if (serviceId) {
      query += ` AND d.hosting_service_id = $${paramCount}`;
      params.push(serviceId);
      paramCount++;
    }
    if (status) {
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    if (search) {
      query += ` AND d.domain ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }
    if (expiringInDays) {
      query += ` AND d.expiration_date <= NOW() + INTERVAL '${expiringInDays} days' AND d.status != 'cancelled'`;
    }

    query += ` ORDER BY d.expiration_date ASC
               LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await client.query(query, params);

    // Count total
    let countQuery = "SELECT COUNT(*)::int AS count FROM domains d WHERE 1=1";
    const countParams = [];
    let countParamCount = 1;
    if (clientId) {
      countQuery += ` AND d.client_id = $${countParamCount}`;
      countParams.push(clientId);
      countParamCount++;
    }
    if (serviceId) {
      countQuery += ` AND d.hosting_service_id = $${countParamCount}`;
      countParams.push(serviceId);
      countParamCount++;
    }
    if (status) {
      countQuery += ` AND d.status = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }
    if (search) {
      countQuery += ` AND d.domain ILIKE $${countParamCount}`;
      countParams.push(`%${search}%`);
      countParamCount++;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = countResult.rows[0].count;

    return {
      data: result.rows,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  } finally {
    client.release();
  }
}

export async function getDomainById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${DOMAIN_SELECT} FROM domains d
       LEFT JOIN clients c ON c.id = d.client_id
       LEFT JOIN hosting_services hs ON hs.id = d.hosting_service_id
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
       WHERE d.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function createDomain(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO domains (client_id, hosting_service_id, domain, registrar, registration_date, expiration_date, annual_cost, customer_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.clientId,
        data.hostingServiceId,
        data.domain,
        data.registrar,
        data.registrationDate,
        data.expirationDate,
        data.annualCost,
        data.customerPrice,
        data.notes,
      ],
    );
    return getDomainById(result.rows[0].id);
  } finally {
    client.release();
  }
}

export async function updateDomain(id, patch) {
  const client = await pool.connect();
  try {
    const updates = [];
    const params = [id];
    let paramCount = 2;

    if (patch.registrar !== undefined) {
      updates.push(`registrar = $${paramCount}`);
      params.push(patch.registrar);
      paramCount++;
    }
    if (patch.expirationDate !== undefined) {
      updates.push(`expiration_date = $${paramCount}`);
      params.push(patch.expirationDate);
      paramCount++;
    }
    if (patch.autoRenew !== undefined) {
      updates.push(`auto_renew = $${paramCount}`);
      params.push(patch.autoRenew);
      paramCount++;
    }
    if (patch.annualCost !== undefined) {
      updates.push(`annual_cost = $${paramCount}`);
      params.push(patch.annualCost);
      paramCount++;
    }
    if (patch.customerPrice !== undefined) {
      updates.push(`customer_price = $${paramCount}`);
      params.push(patch.customerPrice);
      paramCount++;
    }
    if (patch.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(patch.status);
      paramCount++;
    }
    if (patch.notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      params.push(patch.notes);
      paramCount++;
    }

    if (updates.length === 0) return getDomainById(id);

    await client.query(`UPDATE domains SET ${updates.join(", ")} WHERE id = $1`, params);

    return getDomainById(id);
  } finally {
    client.release();
  }
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
