import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authRequired } from "../middlewares/authRequired.js";
import { getClientById, updateClient } from "../services/clients.service.js";
import { listServices } from "../services/hosting.service.js";
import { listDomains } from "../services/domains.service.js";
import { listPayments, listNotices } from "../services/billing.service.js";
import { supportService } from "../services/support.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../../uploads/tickets");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|application\/pdf|audio\/(webm|mp4|ogg|mpeg))$/;
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido. Solo imágenes, PDF y audio."));
    }
  },
});

const router = express.Router();

function requireClientId(req, res, next) {
  if (!req.user?.clientId) {
    return res.status(403).json({ error: { message: "Sin cliente asociado" } });
  }
  next();
}

router.get("/me", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await getClientById(req.user.clientId));
  } catch (err) { next(err); }
});

router.patch("/me", authRequired, requireClientId, async (req, res, next) => {
  try {
    const { name, company, phone } = req.body;
    const updated = await updateClient(req.user.clientId, { name, company, phone });
    res.json(updated);
  } catch (err) { next(err); }
});

router.get("/services", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await listServices({ clientId: req.user.clientId, page: 1, limit: 100 }));
  } catch (err) { next(err); }
});

router.get("/domains", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await listDomains({ clientId: req.user.clientId, page: 1, limit: 100 }));
  } catch (err) { next(err); }
});

router.get("/payments", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await listPayments({ clientId: req.user.clientId, page: 1, limit: 100 }));
  } catch (err) { next(err); }
});

router.get("/notices", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await listNotices({ clientId: req.user.clientId, page: 1, limit: 100 }));
  } catch (err) { next(err); }
});

router.get("/tickets", authRequired, requireClientId, async (req, res, next) => {
  try {
    res.json(await supportService.listTickets({ clientId: req.user.clientId, page: 1, limit: 100 }));
  } catch (err) { next(err); }
});

// Ticket detail + messages (solo el ticket propio del cliente)
router.get("/tickets/:id", authRequired, requireClientId, async (req, res, next) => {
  try {
    const ticket = await supportService.getTicket(req.params.id);
    if (ticket.client_id !== req.user.clientId) {
      return res.status(403).json({ error: { message: "Acceso denegado" } });
    }
    // Filtrar mensajes internos para el cliente
    ticket.messages = ticket.messages.filter((m) => !m.is_internal);
    res.json(ticket);
  } catch (err) { next(err); }
});

// Enviar mensaje (texto o archivo)
router.post(
  "/tickets/:id/messages",
  authRequired,
  requireClientId,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const ticket = await supportService.getTicket(req.params.id);
      if (ticket.client_id !== req.user.clientId) {
        return res.status(403).json({ error: { message: "Acceso denegado" } });
      }

      const { message } = req.body;
      let attachmentUrl = null;
      let attachmentType = null;
      let attachmentName = null;

      if (req.file) {
        attachmentUrl = `/uploads/tickets/${req.file.filename}`;
        attachmentName = req.file.originalname;
        const mime = req.file.mimetype;
        if (mime.startsWith("audio/")) attachmentType = "audio";
        else if (mime.startsWith("image/")) attachmentType = "image";
        else attachmentType = "file";
      }

      if (!message && !attachmentUrl) {
        return res.status(400).json({ error: { message: "Se requiere mensaje o archivo" } });
      }

      const msg = await supportService.addMessage({
        ticketId: req.params.id,
        senderUserId: req.user.sub,
        senderName: ticket.client_name || "Cliente",
        senderRole: "cliente",
        message: message || null,
        isInternal: false,
        attachmentUrl,
        attachmentType,
        attachmentName,
      });

      res.status(201).json(msg);
    } catch (err) { next(err); }
  }
);

// ── Servir adjuntos de tickets (autenticado) ──────────────────
router.get("/uploads/tickets/:filename", authRequired, requireClientId, async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Sanitizar el nombre para evitar path traversal
    const safe = path.basename(filename);
    if (safe !== filename || filename.includes("..")) {
      return res.status(400).json({ error: { message: "Nombre de archivo inválido" } });
    }

    // Verificar que el archivo pertenece a un ticket del cliente
    const { rows } = await (await import("../db/pool.js")).default.query(
      `SELECT t.client_id FROM support_ticket_messages m
       JOIN support_tickets t ON m.ticket_id = t.id
       WHERE m.attachment_url = $1 LIMIT 1`,
      [`/uploads/tickets/${filename}`],
    );

    if (!rows[0]) return res.status(404).json({ error: { message: "Archivo no encontrado" } });
    if (rows[0].client_id !== req.user.clientId) {
      return res.status(403).json({ error: { message: "Acceso denegado" } });
    }

    const filePath = path.join(__dirname, "../../uploads/tickets", safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: "Archivo no encontrado en disco" } });
    }

    res.sendFile(filePath);
  } catch (err) { next(err); }
});

export default router;
