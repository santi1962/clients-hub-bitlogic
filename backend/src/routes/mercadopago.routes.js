import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  MercadoPagoConfig,
  Preference,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";
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

/**
 * Verifica la firma x-signature del webhook siguiendo la documentación
 * oficial de MercadoPago:
 *  - https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/payment-notifications
 *  - https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
 *
 * El manifest ("id:{data.id};request-id:{x-request-id};ts:{ts};", con
 * data.id en minúsculas tomado del QUERY STRING, no del body), el cálculo
 * HMAC-SHA256 en hex y la comparación en tiempo constante los hace el propio
 * validador que trae el SDK oficial (mercadopago@3.1.0, ya instalado) — no
 * es una reimplementación propia del algoritmo.
 *
 * @throws {InvalidWebhookSignatureError} firma ausente, inválida o vencida.
 * @throws {Error} con `.status` si no hay MP_WEBHOOK_SECRET configurado y no
 *   corresponde el bypass explícito de desarrollo.
 */
function verifyMercadoPagoWebhookSignature(req) {
  const { webhookSecret, allowUnsignedWebhook, webhookToleranceSeconds } = config.mercadopago;

  if (!webhookSecret) {
    if (!allowUnsignedWebhook) {
      // Nunca se acepta sin firma "en silencio": sin secret y sin el bypass
      // explícito de desarrollo, se rechaza. En producción allowUnsignedWebhook
      // siempre es false (forzado en config/index.js), así que este es el
      // único camino posible ahí.
      const err = new Error(
        "MP_WEBHOOK_SECRET no configurado — el webhook no puede verificarse y se rechaza. " +
          "En desarrollo, setear MP_WEBHOOK_ALLOW_UNSIGNED=true explícitamente para probar sin firma.",
      );
      err.status = 503;
      throw err;
    }
    log.warn("Webhook de MercadoPago aceptado SIN verificar firma (MP_WEBHOOK_ALLOW_UNSIGNED=true, no usar en producción)");
    return;
  }

  WebhookSignatureValidator.validate({
    xSignature: req.headers["x-signature"],
    xRequestId: req.headers["x-request-id"],
    dataId: req.query["data.id"],
    secret: webhookSecret,
    toleranceSeconds: webhookToleranceSeconds,
  });
}

// ── POST /api/webhooks/mercadopago  (montado en /api/webhooks como /mercadopago)
//
// La firma no reemplaza la verificación posterior: aunque la firma sea
// válida, el pago real se vuelve a consultar contra la API de MercadoPago
// antes de acreditar nada (ver más abajo), y el UPDATE de payment_notices
// sigue siendo idempotente por status = 'paid'.
router.post("/mercadopago", webhookLimiter, async (req, res) => {
  try {
    verifyMercadoPagoWebhookSignature(req);
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      log.warn(`Webhook de MercadoPago rechazado: firma inválida (${err.reason})`, {
        requestId: req.requestId,
        mpRequestId: err.requestId,
      });
      return res.status(401).json({ error: { message: "Firma inválida" } });
    }
    log.error("Webhook de MercadoPago rechazado: no se pudo verificar la firma", {
      requestId: req.requestId,
      err,
    });
    return res.status(err.status ?? 503).json({ error: { message: "Webhook no disponible" } });
  }

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
export { verifyMercadoPagoWebhookSignature };
