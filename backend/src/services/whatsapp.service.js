import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { pino } from "pino";
import fs from "fs";
import config from "../config/index.js";

// ─────────────────────────────────────────────────────────────
// Cliente de WhatsApp (Baileys) — no oficial, usa sesión persistida
// vinculada por QR (como WhatsApp Web). Feature-flag: WHATSAPP_ENABLED.
// ─────────────────────────────────────────────────────────────

let sock = null;
let latestQr = null; // data URL PNG del QR pendiente de escanear
let connectionState = "disconnected"; // disconnected | connecting | qr_pending | connected
const logger = pino({ level: "silent" });

export function getStatus() {
  return { state: connectionState, qr: connectionState === "qr_pending" ? latestQr : null };
}

export async function startWhatsApp() {
  if (!config.whatsapp.enabled) return;
  if (sock) return; // ya inicializado

  fs.mkdirSync(config.whatsapp.sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  connectionState = "connecting";
  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = await QRCode.toDataURL(qr);
      connectionState = "qr_pending";
    }

    if (connection === "open") {
      connectionState = "connected";
      latestQr = null;
      console.log("[WhatsApp] Conectado");
    }

    if (connection === "close") {
      connectionState = "disconnected";
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Conexión cerrada (código ${statusCode}). Reconectar: ${shouldReconnect}`);
      sock = null;
      if (shouldReconnect) {
        setTimeout(() => startWhatsApp(), 3000);
      }
    }
  });
}

export async function logoutWhatsApp() {
  if (sock) {
    await sock.logout().catch(() => {});
    sock = null;
  }
  connectionState = "disconnected";
  latestQr = null;
  fs.rmSync(config.whatsapp.sessionDir, { recursive: true, force: true });
}

/** Formatea un teléfono argentino a formato E.164 sin '+' que espera Baileys (ej: 5491155551234). */
function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("54")) return digits;
  if (digits.startsWith("0")) return `54${digits.slice(1)}`;
  return `54${digits}`;
}

/**
 * Envía un mensaje de WhatsApp. No lanza si WhatsApp no está conectado —
 * solo devuelve false, para no romper el flujo (ej. recordatorios de pago) que lo dispara.
 */
export async function sendWhatsAppMessage(phone, text) {
  if (!config.whatsapp.enabled || connectionState !== "connected" || !sock) return false;
  if (!phone) return false;

  try {
    const jid = `${normalizePhone(phone)}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error("[WhatsApp] Error al enviar mensaje:", err.message);
    return false;
  }
}
