import { Router } from "express";
import pool from "../db/pool.js";
import { authRequired } from "../middlewares/authRequired.js";

const router = Router();

router.get("/", authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id                            AS client_id,
        c.name,
        c.created_at,
        -- service_created: tiene al menos un servicio
        EXISTS (SELECT 1 FROM hosting_services hs WHERE hs.client_id = c.id) AS service_created,
        -- domain_loaded: tiene al menos un dominio
        EXISTS (SELECT 1 FROM domains d WHERE d.client_id = c.id)            AS domain_loaded,
        -- portal_user_created: tiene usuario con rol='cliente'
        EXISTS (SELECT 1 FROM users u WHERE u.client_id = c.id AND u.role = 'cliente' AND u.status = 'active') AS portal_user_created,
        -- first_notice_generated: tiene al menos un aviso
        EXISTS (SELECT 1 FROM payment_notices bn WHERE bn.client_id = c.id)  AS first_notice_generated,
        -- first_payment_registered: tiene al menos un pago
        EXISTS (SELECT 1 FROM payments p WHERE p.client_id = c.id)           AS first_payment_registered
      FROM clients c
      WHERE c.status = 'active'
      ORDER BY c.created_at DESC
      LIMIT 100
    `);

    const clients = rows.map((r) => ({
      client_id: r.client_id,
      name: r.name,
      created_at: r.created_at,
      steps: {
        client_created: true,
        service_created: r.service_created,
        domain_loaded: r.domain_loaded,
        portal_user_created: r.portal_user_created,
        hestia_synced: r.service_created, // si tiene servicio, asumimos sincronizado
        first_notice_generated: r.first_notice_generated,
        first_payment_registered: r.first_payment_registered,
      },
    }));

    res.json(clients);
  } catch (err) {
    next(err);
  }
});

export default router;
