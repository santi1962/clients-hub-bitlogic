import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "load-config.mjs");

// Baseline de una config de producción válida — cada test parte de esto y
// solo rompe/borra la variable que quiere probar. Todos los valores son
// falsos/de prueba, nunca credenciales reales.
const VALID_PROD_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://fake:fake@localhost:5432/fake_test_db",
  JWT_ACCESS_SECRET: "test-access-secret-not-real-0123456789",
  JWT_REFRESH_SECRET: "test-refresh-secret-not-real-0123456789",
  CORS_ORIGIN: "https://example.test",
  FRONTEND_URL: "https://example.test",
};

function runFixture(envOverrides) {
  const result = spawnSync(process.execPath, [FIXTURE], {
    env: { ...VALID_PROD_ENV, ...envOverrides },
    encoding: "utf8",
    timeout: 10_000,
  });
  return result;
}

test("config: producción rechaza CORS_ORIGIN faltante", () => {
  const result = runFixture({ CORS_ORIGIN: "" });
  assert.notEqual(result.status, 0, "el proceso debería salir con código != 0");
  assert.match(result.stderr, /CORS_ORIGIN/);
});

test("config: producción rechaza FRONTEND_URL faltante", () => {
  const result = runFixture({ FRONTEND_URL: "" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FRONTEND_URL/);
});

test("config: producción rechaza BACKEND_PUBLIC_URL faltante SOLO si MP_ACCESS_TOKEN está seteado", () => {
  const withoutMp = runFixture({ MP_ACCESS_TOKEN: "", BACKEND_PUBLIC_URL: "" });
  assert.equal(withoutMp.status, 0, "sin MercadoPago configurado, no debe exigir BACKEND_PUBLIC_URL");

  const withMp = runFixture({ MP_ACCESS_TOKEN: "APP_USR-fake-token-not-real", BACKEND_PUBLIC_URL: "" });
  assert.notEqual(withMp.status, 0, "con MP_ACCESS_TOKEN seteado, BACKEND_PUBLIC_URL pasa a ser obligatorio");
  assert.match(withMp.stderr, /BACKEND_PUBLIC_URL/);
});

test("config: integraciones opcionales desactivadas no bloquean el arranque", () => {
  const result = runFixture({
    MP_ACCESS_TOKEN: "",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_CHAT_ID: "",
    WHATSAPP_ENABLED: "false",
    MP_WEBHOOK_SECRET: "",
  });
  assert.equal(result.status, 0, `debería arrancar limpio; stderr: ${result.stderr}`);
});

test("config: el bypass de webhook sin firmar de MercadoPago se ignora en producción aunque se setee", () => {
  const result = runFixture({ MP_WEBHOOK_ALLOW_UNSIGNED: "true" });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.mercadopagoAllowUnsigned, false, "en producción nunca debe quedar en true");
});

test("config: NODE_ENV con typo cae a modo development sin crashear", () => {
  const result = runFixture({ NODE_ENV: "produciton", CORS_ORIGIN: "", FRONTEND_URL: "" });
  assert.equal(result.status, 0, "no debería exigir CORS_ORIGIN/FRONTEND_URL si no se reconoce como producción");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.nodeEnv, "development");
});

test("config: los secretos nunca aparecen en la salida ni en los mensajes de error", () => {
  const secretMarker = "MARCADOR_SECRETO_QUE_NO_DEBE_APARECER_JAMAS";
  const result = runFixture({
    CORS_ORIGIN: "",
    JWT_ACCESS_SECRET: secretMarker,
    DATABASE_URL: `postgresql://user:${secretMarker}@localhost:5432/db`,
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secretMarker));
  assert.doesNotMatch(result.stderr, new RegExp(secretMarker));
});

test("config: producción con todas las variables requeridas arranca limpio", () => {
  const result = runFixture({});
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.nodeEnv, "production");
  assert.deepEqual(parsed.corsOrigin, ["https://example.test"]);
});
