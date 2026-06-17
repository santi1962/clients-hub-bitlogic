/**
 * Support Tickets Routes
 */
import express from "express";
import {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  addMessage,
  assignTicket,
  resolveTicket,
  closeTicket,
} from "../controllers/support.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff } from "../middlewares/requireRole.js";

const router = express.Router();

// List tickets (staff sees all, clients see own)
router.get("/", authRequired, listTickets);

// Create ticket (staff + clients)
router.post("/", authRequired, createTicket);

// Get single ticket
router.get("/:id", authRequired, getTicket);

// Update ticket (staff only for status/priority)
router.patch("/:id", requireStaff, updateTicket);

// Add message
router.post("/:id/messages", authRequired, addMessage);

// Assign ticket (staff only)
router.post("/:id/assign", requireStaff, assignTicket);

// Resolve ticket (staff only)
router.post("/:id/resolve", requireStaff, resolveTicket);

// Close ticket (staff only)
router.post("/:id/close", requireStaff, closeTicket);

export default router;
