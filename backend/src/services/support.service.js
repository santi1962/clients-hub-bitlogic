/**
 * Support Tickets Service
 * Handles ticket creation, listing, updating, and messaging.
 */
import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import { getIo } from "../socket.js";
import { sendTelegramMessage } from "./telegram.service.js";

function ticketNotFound() {
  const e = new Error("Ticket not found");
  e.status = 404;
  return e;
}

const TICKET_SELECT = `
  t.id, t.ticket_number, t.client_id, t.hosting_service_id, t.subject,
  t.priority, t.status, t.assigned_to, t.created_by,
  t.last_message_at, t.resolved_at, t.closed_at, t.created_at, t.updated_at,
  c.name as client_name, c.company as client_company,
  hs.domain as service_domain,
  u.name as assigned_user_name
`;

export const supportService = {
  /**
   * List tickets with filters
   */
  async listTickets({
    clientId,
    serviceId,
    status,
    priority,
    assignedTo,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const conditions = [];
    const params = [];

    if (clientId) {
      conditions.push(`t.client_id = ?`);
      params.push(clientId);
    }
    if (serviceId) {
      conditions.push(`t.hosting_service_id = ?`);
      params.push(serviceId);
    }
    if (status) {
      conditions.push(`t.status = ?`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`t.priority = ?`);
      params.push(priority);
    }
    if (assignedTo) {
      conditions.push(`t.assigned_to = ?`);
      params.push(assignedTo);
    }
    if (search) {
      // LOWER()/LIKE en vez de ILIKE (no existe en MariaDB) — mismo criterio
      // que el resto de los dominios ya convertidos.
      conditions.push(`(LOWER(t.ticket_number) LIKE LOWER(?) OR LOWER(t.subject) LIKE LOWER(?))`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${TICKET_SELECT}
         FROM support_tickets t
         LEFT JOIN clients c ON t.client_id = c.id
         LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
         LEFT JOIN users u ON t.assigned_to = u.id
         ${where}
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
      // default, MariaDB la nombra "COUNT(*)" literal (mismo hallazgo que
      // en todos los dominios convertidos hasta ahora).
      pool.query(`SELECT COUNT(*) AS count FROM support_tickets t ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  },

  /**
   * Get single ticket with messages
   */
  async getTicket(id) {
    const { rows } = await pool.query(
      `SELECT ${TICKET_SELECT}
       FROM support_tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = ?`,
      [id],
    );

    if (rows.length === 0) {
      throw ticketNotFound();
    }

    const ticket = rows[0];

    const { rows: messages } = await pool.query(
      `SELECT * FROM support_ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id],
    );

    return {
      ...ticket,
      messages,
    };
  },

  /**
   * Create ticket (ticket_number auto-generado por la DB en ambos motores:
   * DEFAULT generate_ticket_number() en Postgres, trigger
   * trg_support_tickets_number en MariaDB — no se envía nunca desde acá,
   * política ya vigente antes de esta fase, sin cambios).
   */
  async createTicket({ clientId, serviceId, subject, priority = "normal", createdBy }) {
    // id generado en la app (UUID v4, crypto.randomUUID) — misma política
    // que el resto de los dominios convertidos. INSERT sin RETURNING +
    // SELECT posterior por id, para además traer ticket_number/created_at
    // ya generados por la DB.
    const id = randomUUID();
    await pool.query(
      `INSERT INTO support_tickets (id, client_id, hosting_service_id, subject, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, clientId, serviceId || null, subject, priority, createdBy || null],
    );
    const { rows } = await pool.query(
      `SELECT ${TICKET_SELECT}
       FROM support_tickets t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = ?`,
      [id],
    );
    const ticket = rows[0];

    sendTelegramMessage(
      `🎫 <b>Ticket nuevo</b> #${ticket.ticket_number}\n${subject}\nPrioridad: ${priority}`,
    );

    return ticket;
  },

  /**
   * Update ticket (status, priority, assign)
   */
  async updateTicket(id, patch) {
    const allowed = ["subject", "priority", "status", "assigned_to"];
    const updates = [];
    const values = [];

    Object.entries(patch).forEach(([key, value]) => {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.getTicket(id);
    }

    // UPDATE...RETURNING -> UPDATE + SELECT posterior. El 404 se decide por
    // el SELECT, no por rowCount: un PATCH que reenvía el mismo valor que
    // ya tenía la fila (ej. reasignar el mismo assigned_to) da rowCount=0 en
    // MariaDB (sin CLIENT_FOUND_ROWS) aunque el ticket exista — mismo
    // patrón que clients/hosting_plans/hosting_services/domains.
    values.push(id);
    await pool.query(`UPDATE support_tickets SET ${updates.join(", ")} WHERE id = ?`, values);

    const { rows } = await pool.query(`SELECT id FROM support_tickets WHERE id = ?`, [id]);
    if (rows.length === 0) throw ticketNotFound();

    return this.getTicket(id);
  },

  /**
   * Add message to ticket
   */
  async addMessage({
    ticketId,
    senderUserId,
    senderName,
    senderRole,
    message,
    isInternal = false,
    attachmentUrl = null,
    attachmentType = null,
    attachmentName = null,
  }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // id generado en la app — mismo criterio que el resto de los
      // dominios. INSERT sin RETURNING + SELECT posterior, todo en la
      // misma conexión/transacción para no perder atomicidad.
      const id = randomUUID();
      await client.query(
        `INSERT INTO support_ticket_messages
           (id, ticket_id, sender_user_id, sender_name, sender_role, message, is_internal,
            attachment_url, attachment_type, attachment_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ticketId,
          senderUserId || null,
          senderName,
          senderRole,
          message || null,
          isInternal,
          attachmentUrl,
          attachmentType,
          attachmentName,
        ],
      );
      const { rows } = await client.query(
        `SELECT * FROM support_ticket_messages WHERE id = ?`,
        [id],
      );
      const msg = rows[0];

      // Update ticket last_message_at
      await client.query(`UPDATE support_tickets SET last_message_at = now() WHERE id = ?`, [ticketId]);

      await client.query("COMMIT");

      // Efectos secundarios SIEMPRE después del COMMIT: si el mensaje ya
      // quedó persistido, un fallo de Socket.IO/Telegram no debe revertir
      // ni reintentar el insert (política ya vigente, conservada).
      getIo()?.to(`ticket:${ticketId}`).emit("ticket:message", msg);

      // Avisar a staff por Telegram solo cuando el mensaje viene del cliente
      if (senderRole === "cliente" && !isInternal) {
        sendTelegramMessage(
          `💬 <b>Respuesta de cliente</b> en ticket\n${senderName}: ${(message || "[archivo adjunto]").slice(0, 200)}`,
        );
      }

      return msg;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Assign ticket
   */
  async assignTicket(id, assignedTo) {
    await pool.query(`UPDATE support_tickets SET assigned_to = ? WHERE id = ?`, [assignedTo, id]);
    const { rows } = await pool.query(`SELECT id FROM support_tickets WHERE id = ?`, [id]);
    if (rows.length === 0) throw ticketNotFound();
    return this.getTicket(id);
  },

  /**
   * Resolve ticket
   */
  async resolveTicket(id) {
    await pool.query(`UPDATE support_tickets SET status = 'resolved', resolved_at = now() WHERE id = ?`, [id]);
    const { rows } = await pool.query(`SELECT id FROM support_tickets WHERE id = ?`, [id]);
    if (rows.length === 0) throw ticketNotFound();
    return this.getTicket(id);
  },

  /**
   * Close ticket
   */
  async closeTicket(id) {
    await pool.query(`UPDATE support_tickets SET status = 'closed', closed_at = now() WHERE id = ?`, [id]);
    const { rows } = await pool.query(`SELECT id FROM support_tickets WHERE id = ?`, [id]);
    if (rows.length === 0) throw ticketNotFound();
    return this.getTicket(id);
  },

  /**
   * Delete ticket and all its messages
   */
  async deleteTicket(id) {
    // Hard delete real: los mensajes se borran en cascada por la FK
    // support_ticket_messages_ticket_id_fkey ON DELETE CASCADE (sin cambios
    // de esta fase). rowCount es seguro para un DELETE (sin ambigüedad
    // "matched pero sin cambio de valor").
    const { rowCount } = await pool.query(`DELETE FROM support_tickets WHERE id = ?`, [id]);
    if (rowCount === 0) throw ticketNotFound();
  },
};
