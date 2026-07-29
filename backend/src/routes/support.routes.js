/**
 * Support Tickets Routes
 */
import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addMessage,
  assignTicket,
  resolveTicket,
  closeTicket,
  deleteTicket,
} from "../controllers/support.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";
import { ticketAttachmentUpload, ticketUploadsDir } from "../middlewares/ticketUpload.js";

// Límites razonables para no dejar que un usuario autenticado inunde el
// servidor de tickets/mensajes/uploads. No aplica a lectura (GET).
const createTicketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: { message: "Demasiados tickets creados. Esperá unos minutos." } },
  standardHeaders: true,
  legacyHeaders: false,
});

const ticketMessageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: { message: "Demasiados mensajes enviados. Esperá unos minutos." } },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// List tickets (staff sees all, clients see own)
router.get("/", authRequired, listTickets);

// Create ticket (staff + clients)
router.post("/", authRequired, createTicketLimiter, createTicket);

// Get single ticket
router.get("/:id", authRequired, getTicket);

// Update ticket (staff only for status/priority)
router.patch("/:id", authRequired, requireStaff, updateTicket);

// Add message (supports file upload)
router.post("/:id/messages", authRequired, ticketMessageLimiter, ticketAttachmentUpload, addMessage);

// Assign ticket (staff only)
router.post("/:id/assign", authRequired, requireStaff, assignTicket);

// Resolve ticket (staff only)
router.post("/:id/resolve", authRequired, requireStaff, resolveTicket);

// Close ticket (staff only)
router.post("/:id/close", authRequired, requireStaff, closeTicket);

// Delete ticket (staff only)
router.delete("/:id", authRequired, requireStaff, deleteTicket);

// Servir adjuntos (staff: acceso a cualquier archivo de tickets)
router.get("/uploads/:filename", authRequired, requireStaff, async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safe = path.basename(filename);
    if (safe !== filename || filename.includes("..")) {
      return res.status(400).json({ error: { message: "Nombre de archivo inválido" } });
    }
    const filePath = path.join(ticketUploadsDir, safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: "Archivo no encontrado" } });
    }
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

export default router;
