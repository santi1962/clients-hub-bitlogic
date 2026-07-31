import "dotenv/config";

const KNOWN_NODE_ENVS = ["development", "production", "test"];
const rawNodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = rawNodeEnv === "production";

if (!KNOWN_NODE_ENVS.includes(rawNodeEnv)) {
  // No es fatal: Express/Node siguen funcionando con cualquier string, pero
  // un typo acá (ej. "produciton") hace que todas las validaciones de abajo
  // se salteen en silencio, que es peor que arrancar en modo "development".
  console.warn(
    `[Config] NODE_ENV="${rawNodeEnv}" no es un valor esperado (${KNOWN_NODE_ENVS.join(", ")}). Se trata como "development".`,
  );
}

const DEV_JWT_DEFAULTS = [
  "dev_access_secret_change_in_prod",
  "dev_refresh_secret_change_in_prod",
];

/** Saca la barra final de una URL (evita "//" al concatenar paths). */
function stripTrailingSlash(url) {
  return url ? url.replace(/\/+$/, "") : url;
}

function parseBool(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return value === "true";
}

/**
 * Arma la connection string de MariaDB. Estrategia oficial: si DATABASE_URL
 * está definida, se usa tal cual (debe ser mysql:// o mysql2://) — soporta
 * el caso de una URL ya armada (ej. provista por el hosting). Si no está
 * definida, se arma a partir de las variables discretas DB_HOST/DB_PORT/
 * DB_NAME/DB_USER/DB_PASSWORD (con DB_PORT default 3306) — esta es la forma
 * recomendada para desarrollo local y para el `.env` de producción, porque
 * evita tener que URL-encodear una password con caracteres especiales.
 *
 * postgresql:// / postgres:// se rechazan explícitamente con un error claro:
 * MariaDB es el único motor soportado desde la Fase DB-5A.
 */
function buildDbConnectionString() {
  const url = process.env.DATABASE_URL;

  if (url) {
    if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
      console.error(
        "[Config] FATAL: DATABASE_URL usa esquema postgresql:// — PostgreSQL ya no es un motor soportado. Usá mysql:// (o las variables DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD).",
      );
      process.exit(1);
    }
    if (!url.startsWith("mysql://") && !url.startsWith("mysql2://")) {
      console.error(
        `[Config] FATAL: DATABASE_URL con esquema no soportado. Se esperaba mysql:// o mysql2://.`,
      );
      process.exit(1);
    }
    return url;
  }

  const host = process.env.DB_HOST;
  const name = process.env.DB_NAME;
  const user = process.env.DB_USER;

  if (!host && !name && !user) {
    // Ninguna variable de DB configurada: se deja que la validación de
    // producción (más abajo) o el intento real de conexión fallen con un
    // mensaje claro, en vez de duplicar el chequeo acá.
    return undefined;
  }

  const port = process.env.DB_PORT ?? "3306";
  const password = process.env.DB_PASSWORD ?? "";
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user ?? "");
  return `mysql://${auth}@${host ?? "localhost"}:${port}/${name ?? ""}`;
}

// ── Validación de variables críticas ────────────────────────────
// Falla de forma explícita en producción si faltan vars o siguen con valores dev.
// No exige nada de integraciones opcionales (MP/Telegram/WhatsApp) salvo que
// esa integración esté efectivamente habilitada.
if (isProduction) {
  const missing = [];

  if (!process.env.DATABASE_URL && !(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)) {
    missing.push("DATABASE_URL (o DB_HOST + DB_NAME + DB_USER)");
  }
  if (!process.env.JWT_ACCESS_SECRET) missing.push("JWT_ACCESS_SECRET");
  if (!process.env.JWT_REFRESH_SECRET) missing.push("JWT_REFRESH_SECRET");
  if (!process.env.CORS_ORIGIN) missing.push("CORS_ORIGIN");
  if (!process.env.FRONTEND_URL) missing.push("FRONTEND_URL");
  // BACKEND_PUBLIC_URL solo hace falta si MercadoPago está configurado: es la
  // URL que se le manda a MP para el webhook de notificación de pagos.
  if (process.env.MP_ACCESS_TOKEN && !process.env.BACKEND_PUBLIC_URL) {
    missing.push("BACKEND_PUBLIC_URL (requerido porque MP_ACCESS_TOKEN está configurado)");
  }
  // SSO con Bitiando (login único de staff): sin esto, nadie del staff puede
  // entrar al panel — solo el portal de clientes (que no usa SSO) seguiría andando.
  if (!process.env.BITIANDO_API_URL) missing.push("BITIANDO_API_URL");

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
  nodeEnv: KNOWN_NODE_ENVS.includes(rawNodeEnv) ? rawNodeEnv : "development",

  db: {
    connectionString: buildDbConnectionString(),
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_in_prod",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_in_prod",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "30d",
    refreshExpiryShort: process.env.JWT_REFRESH_EXPIRY_SHORT ?? "1d",
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((o) => stripTrailingSlash(o.trim())),
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

  frontendUrl: stripTrailingSlash(process.env.FRONTEND_URL ?? "http://localhost:5173"),

  // SSO: Bitiando es el proveedor de identidad único para el staff (login
  // único). El hub confía en su cookie de sesión — la reenvía a
  // GET /api/auth/me de Bitiando para saber quién es, y mapea por email
  // contra la propia tabla `users` del hub (el portal de clientes no usa esto).
  bitiando: {
    apiUrl: stripTrailingSlash(process.env.BITIANDO_API_URL ?? "http://localhost:4000"),
    sessionCookie: "bitiando_session",
  },

  // URL pública del propio backend (para armar el webhook de MercadoPago).
  // Antes se leía process.env.BACKEND_PUBLIC_URL directo en mercadopago.routes.js;
  // ahora pasa por acá para quedar validado y normalizado en un solo lugar.
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL
    ? stripTrailingSlash(process.env.BACKEND_PUBLIC_URL)
    : null,

  mercadopago: {
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
    // Ventana de tolerancia contra replay del timestamp del header x-signature.
    // 300s (5 min) es un margen razonable para drift de reloj + latencia de red,
    // sin dejar la ventana de reintento abierta indefinidamente.
    webhookToleranceSeconds: parseInt(process.env.MP_WEBHOOK_TOLERANCE_SECONDS ?? "300", 10),
    // Bypass EXPLÍCITO de la verificación de firma cuando no hay
    // MP_WEBHOOK_SECRET configurado — solo para probar el flujo de checkout/
    // webhook en desarrollo sin tener that secret todavía. Nunca implícito:
    // sin este flag en true, la ausencia de secret rechaza el webhook (no lo
    // acepta sin firmar). Se fuerza a false en producción sin importar el
    // valor de la env var: no existe forma de habilitar el bypass en prod.
    allowUnsignedWebhook: isProduction ? false : parseBool(process.env.MP_WEBHOOK_ALLOW_UNSIGNED, false),
  },

  hestia: {
    url: process.env.HESTIA_API_URL ? stripTrailingSlash(process.env.HESTIA_API_URL) : process.env.HESTIA_API_URL,
    username: process.env.HESTIA_USERNAME,
    password: process.env.HESTIA_PASSWORD,
    apiKey: process.env.HESTIA_API_KEY,
    // Semántica "opt-out": true salvo que se ponga explícitamente "false".
    // Un valor mal escrito (ej. "flase") no debe apagar la verificación SSL sin querer.
    verifySsl: process.env.HESTIA_VERIFY_SSL !== "false",
    useApiKey: !!process.env.HESTIA_API_KEY,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
    enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  },

  whatsapp: {
    enabled: parseBool(process.env.WHATSAPP_ENABLED, false),
    sessionDir: process.env.WHATSAPP_SESSION_DIR ?? "./whatsapp-session",
  },

  scheduler: {
    // Default: false en desarrollo, true en producción — salvo override explícito.
    enabled: parseBool(process.env.SCHEDULER_ENABLED, isProduction),
    timezone: process.env.SCHEDULER_TIMEZONE || "America/Argentina/Buenos_Aires",
    // Horarios de producción, overrideables individualmente (ej. para pruebas).
    schedules: {
      hestiaSync: process.env.SCHEDULE_HESTIA_SYNC || "30 2 * * *",
      delinquencyDetection: process.env.SCHEDULE_DELINQUENCY_DETECTION || "0 8 * * *",
      paymentReminders: process.env.SCHEDULE_PAYMENT_REMINDERS || "0 9 * * *",
    },
  },
};

export default config;
