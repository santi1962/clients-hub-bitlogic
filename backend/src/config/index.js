import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

const DEV_JWT_DEFAULTS = [
  "dev_access_secret_change_in_prod",
  "dev_refresh_secret_change_in_prod",
];

// ── Validación de variables críticas ────────────────────────────
// Falla de forma explícita en producción si faltan vars o siguen con valores dev.
if (isProduction) {
  const missing = [];

  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!process.env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");

  if (missing.length > 0) {
    console.error(`[Config] Variables de entorno requeridas faltantes: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (DEV_JWT_DEFAULTS.includes(process.env.JWT_ACCESS_SECRET) ||
      DEV_JWT_DEFAULTS.includes(process.env.JWT_REFRESH_SECRET) ||
      process.env.JWT_ACCESS_SECRET?.startsWith("dev_") ||
      process.env.JWT_REFRESH_SECRET?.startsWith("dev_")) {
    console.error("[Config] FATAL: JWT secrets siguen con valores de desarrollo. Generá secrets seguros antes de deployar.");
    process.exit(1);
  }
}

const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  db: {
    connectionString: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_in_prod",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_in_prod",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "30d",
    refreshExpiryShort: process.env.JWT_REFRESH_EXPIRY_SHORT ?? "1d",
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim()),
  },

  bcrypt: {
    rounds: 12,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "2525", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME ?? "Bitlogic",
    fromEmail: process.env.SMTP_FROM_EMAIL ?? "noreply@bitlogic.com.ar",
  },

  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",

  mercadopago: {
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
  },

  hestia: {
    url: process.env.HESTIA_API_URL,
    username: process.env.HESTIA_USERNAME,
    password: process.env.HESTIA_PASSWORD,
    apiKey: process.env.HESTIA_API_KEY,
    verifySsl: process.env.HESTIA_VERIFY_SSL !== "false",
    useApiKey: !!process.env.HESTIA_API_KEY,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
    enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  },

  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === "true",
    sessionDir: process.env.WHATSAPP_SESSION_DIR ?? "./whatsapp-session",
  },
};

export default config;
