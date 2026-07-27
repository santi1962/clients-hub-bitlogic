import config from "../config/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("telegram");

/**
 * Envía un mensaje al chat de Telegram configurado (staff).
 * No lanza si Telegram no está configurado — solo loguea, para no romper el flujo que dispara la notificación.
 */
export async function sendTelegramMessage(text) {
  if (!config.telegram.enabled) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text,
        parse_mode: "HTML",
      }),
      // Sin timeout, un Telegram que no responde deja la promesa colgada
      // indefinidamente (AbortSignal.timeout es nativo de Node, sin libs nuevas).
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error(`Error al enviar mensaje: ${res.status}`, { body });
    }
  } catch (err) {
    log.error("Error de red al enviar mensaje", { err });
  }
}
