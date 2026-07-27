/**
 * Support Tickets Routes
 */
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
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
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();

// List tickets (staff sees all, clients see own)
router.get("/", authRequired, listTickets);

// Create ticket (staff + clients)
router.post("/", authRequired, createTicket);

// Get single ticket
router.get("/:id", authRequired, getTicket);

// Update ticket (staff only for status/priority)
router.patch("/:id", authRequired, requireStaff, updateTicket);

// Add message (supports file upload)
router.post("/:id/messages", authRequired, upload.single("file"), addMessage);

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
    const filePath = path.join(__dirname, "../../uploads/tickets", safe);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: "Archivo no encontrado" } });
    }
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

export default router;
