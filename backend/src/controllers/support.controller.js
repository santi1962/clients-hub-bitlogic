/**
 * Support Tickets Controller
 */
import { supportService } from "../services/support.service.js";
import { emailService } from "../services/email.service.js";
import { auditService } from "../services/audit.service.js";

export async function listTickets(req, res) {
  try {
    let { clientId, serviceId, status, priority, assignedTo, search, page, limit } = req.query;

    // Si es cliente, solo ve sus propios tickets
    if (req.user?.role === "cliente") {
      if (!req.user.clientId) {
        return res.status(403).json({ error: "Cliente sin clientId asociado" });
      }
      clientId = req.user.clientId; // Force own clientId
    }

    const result = await supportService.listTickets({
      clientId,
      serviceId,
      status,
      priority,
      assignedTo,
      search,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });

    res.json(result);
  } catch (err) {
    console.error("Error listing tickets:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function getTicket(req, res) {
  try {
    const { id } = req.params;
    const ticket = await supportService.getTicket(id);

    // Si es cliente, solo puede ver sus propios tickets
    if (req.user?.role === "cliente") {
      if (ticket.client_id !== req.user.clientId) {
        return res.status(403).json({ error: "No tienes acceso a este ticket" });
      }
      // Filtrar mensajes internos
      ticket.messages = ticket.messages.filter((m) => !m.is_internal);
    }

    res.json(ticket);
  } catch (err) {
    console.error("Error getting ticket:", err);
    res.status(err.message === "Ticket not found" ? 404 : 500).json({ error: err.message });
  }
}

export async function createTicket(req, res) {
  try {
    let { clientId, serviceId, subject, priority } = req.body;
    const createdBy = req.user?.id;

    if (!subject) {
      return res.status(400).json({ error: "subject required" });
    }

    // Si es cliente, forzar clientId = el suyo
    if (req.user?.role === "cliente") {
      if (!req.user.clientId) {
        return res.status(403).json({ error: "Cliente sin clientId asociado" });
      }
      clientId = req.user.clientId; // Ignore body, use authenticated user
    } else if (!clientId) {
      return res.status(400).json({ error: "clientId required for staff" });
    }

    const ticket = await supportService.createTicket({
      clientId,
      serviceId,
      subject,
      priority,
      createdBy,
    });

    await auditService.logAction({
      user: req.user,
      action: "crear",
      entityType: "ticket",
      entityId: ticket.id,
      entityName: ticket.ticketNumber,
      newValues: { subject, priority },
    });

    res.status(201).json(ticket);
  } catch (err) {
    console.error("Error creating ticket:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const ticket = await supportService.updateTicket(id, req.body);
    res.json(ticket);
  } catch (err) {
    console.error("Error updating ticket:", err);
    res.status(err.message === "Ticket not found" ? 404 : 500).json({ error: err.message });
  }
}

export async function addMessage(req, res) {
  try {
    const { id } = req.params;
    let { message, isInternal } = req.body;

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
      return res.status(400).json({ error: "message or file required" });
    }

    // Clientes nunca pueden crear mensajes internos (forzar a false)
    if (req.user?.role === "cliente") {
      isInternal = false;
    }

    const msg = await supportService.addMessage({
      ticketId: id,
      senderUserId: req.user?.id,
      senderName: req.user?.name || "Anonymous",
      senderRole: req.user?.role || "cliente",
      message: message || null,
      isInternal: isInternal || false,
      attachmentUrl,
      attachmentType,
      attachmentName,
    });

    // Send email notification if message is not internal
    if (!msg.is_internal) {
      try {
        await emailService.sendTicketReplyEmail(id, msg.id);
      } catch (emailErr) {
        console.error("Email sending failed but message saved:", emailErr);
      }
    }

    await auditService.logAction({
      user: req.user,
      action: "responder",
      entityType: "ticket",
      entityId: id,
      newValues: { message, isInternal: msg.is_internal },
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function assignTicket(req, res) {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ error: "assignedTo required" });
    }

    const ticket = await supportService.assignTicket(id, assignedTo);
    res.json(ticket);
  } catch (err) {
    console.error("Error assigning ticket:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function resolveTicket(req, res) {
  try {
    const { id } = req.params;
    const oldTicket = await supportService.getTicket(id, req.user);
    const ticket = await supportService.resolveTicket(id);
    await auditService.logAction({
      user: req.user,
      action: "resolver",
      entityType: "ticket",
      entityId: id,
      entityName: oldTicket.ticketNumber,
      oldValues: { status: oldTicket.status },
      newValues: { status: "resolved" },
    });
    res.json(ticket);
  } catch (err) {
    console.error("Error resolving ticket:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function closeTicket(req, res) {
  try {
    const { id } = req.params;
    const oldTicket = await supportService.getTicket(id, req.user);
    const ticket = await supportService.closeTicket(id);
    await auditService.logAction({
      user: req.user,
      action: "cerrar",
      entityType: "ticket",
      entityId: id,
      entityName: oldTicket.ticketNumber,
      oldValues: { status: oldTicket.status },
      newValues: { status: "closed" },
    });
    res.json(ticket);
  } catch (err) {
    console.error("Error closing ticket:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTicket(req, res) {
  try {
    const { id } = req.params;
    const ticket = await supportService.getTicket(id);
    await supportService.deleteTicket(id);
    await auditService.logAction({
      user: req.user,
      action: "eliminar",
      entityType: "ticket",
      entityId: id,
      entityName: ticket.ticket_number,
    });
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting ticket:", err);
    res.status(err.message === "Ticket not found" ? 404 : 500).json({ error: err.message });
  }
}
