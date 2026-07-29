import express from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { sendTelegramMessage } from "../services/telegram.service.js";
import config from "../config/index.js";

const router = express.Router();

router.post("/test", authRequired, requireAdmin, async (req, res) => {
  if (!config.telegram.enabled) {
    return res.status(409).json({
      error: { message: "Telegram no está configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en .env)" },
    });
  }
  await sendTelegramMessage("✅ Prueba de notificaciones de Bitlogic Client Hub. Si ves esto, Telegram está bien configurado.");
  res.json({ ok: true });
});

export default router;
