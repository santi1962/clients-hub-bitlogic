import { Router } from "express";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import pool from "../db/pool.js";
import config from "../config/index.js";
import { authRequired } from "../middlewares/authRequired.js";

const router = Router();

function getMpClient() {
  if (!config.mercadopago.accessToken) {
    throw new Error("MP_ACCESS_TOKEN no configurado");
  }
  return new MercadoPagoConfig({ accessToken: config.mercadopago.accessToken });
}

// ── POST /api/portal/payments/checkout/:noticeId
// Crea una preferencia de pago en MP y devuelve la URL de checkout
router.post("/checkout/:noticeId", authRequired, async (req, res, next) => {
  try {
    if (!req.user.clientId) {
      return res.status(403).json({ error: { message: "Sin cliente asociado" } });
    }

    const { rows } = await pool.query(
      `SELECT
         pn.id, pn.notice_number, pn.amount, pn.status,
         pn.period_month, pn.period_year, pn.due_date,
         c.name AS client_name, c.email AS client_email,
         hs.domain AS service_domain
       FROM payment_notices pn
       JOIN clients c ON pn.client_id = c.id
       JOIN hosting_services hs ON pn.hosting_service_id = hs.id
       WHERE pn.id = $1 AND pn.client_id = $2`,
      [req.params.noticeId, req.user.clientId],
    );

    const notice = rows[0];
    if (!notice) return res.status(404).json({ error: { message: "Aviso no encontrado" } });
    if (notice.status === "paid" || notice.status === "pagado") {
      return res.status(400).json({ error: { message: "El aviso ya fue pagado" } });
    }

    const client = getMpClient();
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: notice.id,
            title: `Hosting ${notice.service_domain} — ${notice.period_month}/${notice.period_year}`,
            description: `Aviso de pago #${notice.notice_number}`,
            quantity: 1,
            unit_price: Number(notice.amount),
            currency_id: "ARS",
          },
        ],
        payer: {
          name: notice.client_name,
          email: notice.client_email,
        },
        external_reference: notice.id,
        back_urls: {
          success: `${config.frontendUrl}/portal/pago-exitoso`,
          failure: `${config.frontendUrl}/portal/pago-fallido`,
          pending: `${config.frontendUrl}/portal/pago-pendiente`,
        },
        auto_return: "approved",
        notification_url: `${process.env.BACKEND_PUBLIC_URL ?? config.frontendUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "BITLOGIC",
      },
    });

    res.json({ checkoutUrl: result.init_point, sandboxUrl: result.sandbox_init_point });
  } catch (err) { next(err); }
});

// ── POST /api/webhooks/mercadopago  (montado en /api/webhooks como /mercadopago)
router.post("/mercadopago", async (req, res) => {
  try {
    const { type, data } = req.body ?? {};

    // Solo procesar pagos aprobados
    if (type !== "payment" || !data?.id) {
      return res.sendStatus(200);
    }

    const client = getMpClient();
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: data.id });

    if (payment.status !== "approved") return res.sendStatus(200);

    const noticeId = payment.external_reference;
    if (!noticeId) return res.sendStatus(200);

    // Verificar que el aviso existe y no fue pagado ya
    const { rows } = await pool.query(
      `SELECT id, client_id, hosting_service_id, period_month, period_year, amount, status
       FROM payment_notices WHERE id = $1`,
      [noticeId],
    );
    const notice = rows[0];
    if (!notice || notice.status === "paid") return res.sendStatus(200);

    // Registrar pago y marcar aviso como pagado en una transacción
    const db = await pool.connect();
    try {
      await db.query("BEGIN");

      await db.query(
        `INSERT INTO payments
           (client_id, hosting_service_id, payment_notice_id, period_month, period_year,
            amount, method, status, paid_at, reference, internal_notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'mercadopago', 'paid', now(), $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          notice.client_id,
          notice.hosting_service_id,
          notice.id,
          notice.period_month,
          notice.period_year,
          payment.transaction_amount ?? notice.amount,
          String(payment.id),
          `Pago MP ID: ${payment.id}`,
        ],
      );

      await db.query(
        `UPDATE payment_notices SET status = 'paid', updated_at = now() WHERE id = $1`,
        [noticeId],
      );

      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("[MercadoPago Webhook]", err.message);
    res.sendStatus(200); // Siempre 200 para que MP no reintente indefinidamente
  }
});

export default router;
