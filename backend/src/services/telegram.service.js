import config from "../config/index.js";

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
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Telegram] Error al enviar mensaje: ${res.status} ${body}`);
    }
  } catch (err) {
    console.error("[Telegram] Error de red al enviar mensaje:", err.message);
  }
}
