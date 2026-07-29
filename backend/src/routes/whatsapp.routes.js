import express from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { getStatus, startWhatsApp, logoutWhatsApp, sendWhatsAppMessage } from "../services/whatsapp.service.js";
import config from "../config/index.js";

const router = express.Router();

router.get("/status", authRequired, requireAdmin, (req, res) => {
  res.json({ enabled: config.whatsapp.enabled, ...getStatus() });
});

router.post("/connect", authRequired, requireAdmin, async (req, res, next) => {
  try {
    if (!config.whatsapp.enabled) {
      return res.status(409).json({ error: { message: "WHATSAPP_ENABLED no está activado en el .env" } });
    }
    await startWhatsApp();
    res.json(getStatus());
  } catch (err) {
    next(err);
  }
});

router.post("/logout", authRequired, requireAdmin, async (req, res, next) => {
  try {
    await logoutWhatsApp();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/test", authRequired, requireAdmin, async (req, res, next) => {
  try {
    const { phone, message } = req.body ?? {};
    if (!phone || !message) {
      return res.status(400).json({ error: { message: "Faltan phone y message" } });
    }
    const sent = await sendWhatsAppMessage(phone, message);
    if (!sent) {
      return res.status(409).json({ error: { message: "WhatsApp no está conectado" } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
