import { test, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { InvalidWebhookSignatureError } from "mercadopago";
import pool from "../src/db/pool.js";
import app from "../src/app.js";
import config from "../src/config/index.js";
import { verifyMercadoPagoWebhookSignature } from "../src/routes/mercadopago.routes.js";
import { startEphemeralServer } from "./helpers/server.js";

after(() => pool.end());

const SECRET = "test_secret_not_real";

// config es un objeto plano (no congelado): lo pisamos directamente para
// simular distintos escenarios de configuración dentro del mismo proceso,
// sin necesidad de spawnear procesos hijos para cada caso.
beforeEach(() => {
  config.mercadopago.webhookSecret = SECRET;
  config.mercadopago.allowUnsignedWebhook = false;
  config.mercadopago.webhookToleranceSeconds = 300;
});

function buildSignedReq({ dataId = "123456789", requestId = "req-1", ts = Date.now().toString(), secret = SECRET } = {}) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return {
    headers: { "x-signature": `ts=${ts},v1=${hash}`, "x-request-id": requestId },
    query: { "data.id": dataId },
  };
}

test("mercadopago webhook: firma válida no lanza excepción", () => {
  assert.doesNotThrow(() => verifyMercadoPagoWebhookSignature(buildSignedReq()));
});

test("mercadopago webhook: firma ausente se rechaza", () => {
  const req = { headers: {}, query: { "data.id": "123" } };
  assert.throws(() => verifyMercadoPagoWebhookSignature(req), InvalidWebhookSignatureError);
});

test("mercadopago webhook: firma calculada con un secret distinto se rechaza", () => {
  const req = buildSignedReq({ secret: "otro-secret-distinto" });
  assert.throws(() => verifyMercadoPagoWebhookSignature(req), InvalidWebhookSignatureError);
});

test("mercadopago webhook: timestamp fuera de la ventana de tolerancia se rechaza", () => {
  const oldTs = (Date.now() - 3600 * 1000).toString(); // hace 1 hora, tolerancia default 300s
  const req = buildSignedReq({ ts: oldTs });
  assert.throws(() => verifyMercadoPagoWebhookSignature(req), InvalidWebhookSignatureError);
});

test("mercadopago webhook: header x-signature malformado se rechaza", () => {
  const req = { headers: { "x-signature": "esto-no-tiene-el-formato-ts-v1", "x-request-id": "req-1" }, query: {} };
  assert.throws(() => verifyMercadoPagoWebhookSignature(req), InvalidWebhookSignatureError);
});

test("mercadopago webhook: sin MP_WEBHOOK_SECRET configurado y sin bypass, se rechaza (nunca implícito)", () => {
  config.mercadopago.webhookSecret = "";
  config.mercadopago.allowUnsignedWebhook = false;
  assert.throws(() => verifyMercadoPagoWebhookSignature({ headers: {}, query: {} }), /no configurado/);
});

test("mercadopago webhook: sin secret pero CON bypass explícito de desarrollo, no lanza", () => {
  config.mercadopago.webhookSecret = "";
  config.mercadopago.allowUnsignedWebhook = true;
  assert.doesNotThrow(() => verifyMercadoPagoWebhookSignature({ headers: {}, query: {} }));
});

test("mercadopago webhook: el endpoint HTTP responde 401 ante una firma inválida sin llamar a MercadoPago real", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  const req = buildSignedReq({ secret: "secret-incorrecto" });
  const res = await fetch(`${baseUrl}/api/webhooks/mercadopago?data.id=123456789`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": req.headers["x-signature"],
      "x-request-id": req.headers["x-request-id"],
    },
    body: JSON.stringify({ type: "payment", data: { id: "123456789" } }),
  });

  // 401 (no 200/503) confirma que se rechazó por firma, sin llegar a
  // getMpClient()/Payment.get() — no hay MP_ACCESS_TOKEN configurado en el
  // proceso de test, así que si hubiera intentado llamar a MP real habría
  // fallado con 503 en vez de 401.
  assert.equal(res.status, 401);
});

test("mercadopago webhook: el endpoint HTTP acepta y sigue de largo con firma válida y payload sin pago aprobado", async (t) => {
  const { baseUrl, close } = await startEphemeralServer(app);
  t.after(close);

  // type distinto de "payment" corta temprano con 200, antes de llamar a MP.
  const req = buildSignedReq({ dataId: "999" });
  const res = await fetch(`${baseUrl}/api/webhooks/mercadopago?data.id=999`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": req.headers["x-signature"],
      "x-request-id": req.headers["x-request-id"],
    },
    body: JSON.stringify({ type: "test", data: { id: "999" } }),
  });

  assert.equal(res.status, 200);
});
