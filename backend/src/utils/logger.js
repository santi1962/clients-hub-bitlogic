/**
 * Utilidad de logging mínima para un VPS único detrás de PM2.
 * Escribe una línea JSON por evento a stdout/stderr (PM2 captura ambos).
 * No usa Winston/Pino: no hace falta rotación ni transports en este entorno.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

// Claves que nunca deben aparecer en un log, sin importar en qué parte del
// objeto de contexto vengan (headers, body, config, etc.)
const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "database_url",
  "jwt_access_secret",
  "jwt_refresh_secret",
  "smtp_pass",
  "mp_access_token",
  "mp_webhook_secret",
  "hestia_password",
  "hestia_api_key",
  "telegram_bot_token",
  "secret",
]);

function redact(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      out[key] = redact(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function write(level, moduleName, message, meta) {
  if (LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module: moduleName,
    message,
  };

  if (meta && typeof meta === "object") {
    const { requestId, err, error, ...rest } = meta;
    if (requestId) entry.requestId = requestId;

    const realErr = err ?? error;
    if (realErr instanceof Error) {
      entry.error = realErr.message;
      if (realErr.stack) entry.stack = realErr.stack;
    } else if (realErr) {
      entry.error = String(realErr);
    }

    Object.assign(entry, redact(rest));
  }

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Crea un logger atado a un nombre de módulo (ej. "app", "socket", "hestia"). */
export function createLogger(moduleName) {
  return {
    error: (message, meta) => write("error", moduleName, message, meta),
    warn: (message, meta) => write("warn", moduleName, message, meta),
    info: (message, meta) => write("info", moduleName, message, meta),
    debug: (message, meta) => write("debug", moduleName, message, meta),
  };
}

export default createLogger;
