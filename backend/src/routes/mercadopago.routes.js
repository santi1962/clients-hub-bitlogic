import { Router } from "express";
import rateLimit from "express-rate-limit";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import pool from "../db/pool.js";
import config from "../config/index.js";
import { authRequired } from "../middlewares/authRequired.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("mercadopago");
const router = Router();

function getMpClient() {
  if (!config.mercadopago.accessToken) {
    const err = new Error("MercadoPago no está configurado todavía");
    err.status = 503;
    throw err;
  }
  return new MercadoPagoConfig({ accessToken: config.mercadopago.accessToken });
}

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { message: "Demasiados intentos de pago. Esperá unos minutos." } },
  standardHeaders: true,
  legacyHeaders: false,
});

// El webhook lo llama MercadoPago, no un usuario logueado — el límite es más
// alto para tolerar reintentos legítimos de notificación sin frenar pagos reales.
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { error: { message: "Too many requests" } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/portal/payments/checkout/:noticeId
// Crea una preferencia de pago en MP y devuelve la URL de checkout
router.post("/checkout/:noticeId", authRequired, checkoutLimiter, async (req, res, next) => {
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
        notification_url: `${config.backendPublicUrl ?? config.frontendUrl}/api/webhooks/mercadopago`,
        statement_descriptor: "BITLOGIC",
      },
    });

    res.json({ checkoutUrl: result.init_point, sandboxUrl: result.sandbox_init_point });
  } catch (err) { next(err); }
});

// ── POST /api/webhooks/mercadopago  (montado en /api/webhooks como /mercadopago)
//
// HALLAZGO DE SEGURIDAD PENDIENTE (no resuelto en esta fase de hardening,
// requiere decisión externa): este webhook no verifica la firma
// `x-signature`/`x-request-id` que MercadoPago envía junto al webhook
// (ver https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications/webhooks).
// Hoy cualquiera que conozca esta URL puede simular una notificación de pago
// aprobado. Mitigación parcial existente: se vuelve a consultar el pago real
// contra la API de MercadoPago con el access token propio antes de acreditar
// nada, así que un request falso no puede inventar un pago que no exista en
// la cuenta de MercadoPago real — pero si un pago legítimo de OTRO aviso ya
// existe, un atacante podría intentar reutilizar su `data.id` contra avisos
// ajenos. Corregir esto es tarea de la próxima fase de seguridad, no de esta.
router.post("/mercadopago", webhookLimiter, async (req, res) => {
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
    log.error("Error procesando webhook de MercadoPago", { requestId: req.requestId, err });
    res.sendStatus(200); // Siempre 200 para que MP no reintente indefinidamente
  }
});

export default router;
