// Fixture ejecutado en un proceso hijo separado por config.test.js.
// config/index.js valida variables de entorno al importarse y hace
// process.exit(1) si algo falta — no se puede importar en el mismo proceso
// que corre los tests sin arriesgarse a matar el test runner.
import config from "../../src/config/index.js";

process.stdout.write(
  JSON.stringify({
    nodeEnv: config.nodeEnv,
    corsOrigin: config.cors.origin,
    mercadopagoAllowUnsigned: config.mercadopago.allowUnsignedWebhook,
  }),
);
