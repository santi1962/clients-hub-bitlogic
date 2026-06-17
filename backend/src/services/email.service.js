/**
 * Email Service
 * Handles sending emails via SMTP and logging
 */
import nodemailer from "nodemailer";
import config from "../config/index.js";
import pool from "../db/pool.js";

let transporter = null;

function getTransporter() {
  if (!transporter && config.smtp.host && config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

async function logEmail({
  type,
  recipient,
  subject,
  status,
  providerId,
  errorMessage,
  clientId,
  noticeId,
  ticketId,
  domainId,
  sentAt,
}) {
  try {
    await pool.query(
      `INSERT INTO email_logs
        (type, recipient, subject, status, provider_message_id, error_message,
         related_client_id, related_notice_id, related_ticket_id, related_domain_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        type,
        recipient,
        subject,
        status,
        providerId || null,
        errorMessage || null,
        clientId || null,
        noticeId || null,
        ticketId || null,
        domainId || null,
        sentAt || null,
      ],
    );
  } catch (err) {
    console.error("Error logging email:", err);
  }
}

export const emailService = {
  /**
   * Send a raw email
   */
  async sendEmail({ to, subject, html, text }) {
    const transporter_ = getTransporter();

    if (!transporter_) {
      throw new Error("SMTP not configured");
    }

    try {
      const info = await transporter_.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
        to,
        subject,
        html: html || text,
        text: text || html,
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("Error sending email:", err);
      throw err;
    }
  },

  /**
   * Send payment notice email to client
   */
  async sendPaymentNoticeEmail(noticeId) {
    const query = `
      SELECT
        n.id, n.notice_number, n.amount, n.due_date, n.period_month, n.period_year,
        c.name, c.email, c.company,
        hs.domain
      FROM payment_notices n
      JOIN clients c ON c.id = n.client_id
      LEFT JOIN hosting_services hs ON hs.id = n.hosting_service_id
      WHERE n.id = $1
    `;

    try {
      const result = await pool.query(query, [noticeId]);
      if (result.rows.length === 0) {
        throw new Error("Notice not found");
      }

      const notice = result.rows[0];
      const subject = `Aviso de pago ${notice.notice_number} - Bitlogic`;
      const html = `
        <h2>Hola ${notice.name},</h2>
        <p>Te enviamos el aviso de pago correspondiente.</p>
        <ul>
          <li><strong>Número:</strong> ${notice.notice_number}</li>
          <li><strong>Monto:</strong> $${notice.amount}</li>
          <li><strong>Vencimiento:</strong> ${notice.due_date}</li>
          ${notice.domain ? `<li><strong>Servicio:</strong> ${notice.domain}</li>` : ""}
        </ul>
        <p>Ingresá a tu portal para pagar: <a href="https://portal.bitlogic.com.ar">Ir al portal</a></p>
        <p>¡Gracias!</p>
      `;

      const { success, messageId } = await this.sendEmail({
        to: notice.email,
        subject,
        html,
      });

      // Log success
      await logEmail({
        type: "payment_notice",
        recipient: notice.email,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        clientId: notice.id,
        noticeId,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      // Log failure
      await logEmail({
        type: "payment_notice",
        recipient: "unknown",
        subject: `Aviso de pago - Bitlogic`,
        status: "failed",
        errorMessage: err.message,
        noticeId,
      });

      throw err;
    }
  },

  /**
   * Send ticket reply notification email to client
   */
  async sendTicketReplyEmail(ticketId, messageId) {
    const ticketQuery = `
      SELECT
        t.id, t.ticket_number, t.subject, c.email, c.name, c.company
      FROM support_tickets t
      JOIN clients c ON c.id = t.client_id
      WHERE t.id = $1
    `;

    const messageQuery = `
      SELECT message, created_at
      FROM support_ticket_messages
      WHERE id = $1
    `;

    try {
      const tResult = await pool.query(ticketQuery, [ticketId]);
      const mResult = await pool.query(messageQuery, [messageId]);

      if (tResult.rows.length === 0 || mResult.rows.length === 0) {
        throw new Error("Ticket or message not found");
      }

      const ticket = tResult.rows[0];
      const message = mResult.rows[0];

      const subject = `RE: ${ticket.ticket_number} - ${ticket.subject}`;
      const html = `
        <h2>Hola ${ticket.name},</h2>
        <p>Tu ticket ${ticket.ticket_number} ha recibido una respuesta.</p>
        <blockquote style="border-left: 4px solid #ccc; padding-left: 10px;">
          ${message.message}
        </blockquote>
        <p>Ingresá a tu portal para ver el detalle: <a href="https://portal.bitlogic.com.ar/tickets/${ticketId}">Ver ticket</a></p>
      `;

      const { success, messageId: providerId } = await this.sendEmail({
        to: ticket.email,
        subject,
        html,
      });

      await logEmail({
        type: "ticket_reply",
        recipient: ticket.email,
        subject,
        status: success ? "sent" : "failed",
        providerId,
        clientId: ticket.id,
        ticketId,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId: providerId };
    } catch (err) {
      await logEmail({
        type: "ticket_reply",
        recipient: "unknown",
        subject: "Respuesta a ticket",
        status: "failed",
        errorMessage: err.message,
        ticketId,
      });

      throw err;
    }
  },

  /**
   * Send domain renewal reminder email to client
   */
  async sendDomainReminderEmail(domainId) {
    const query = `
      SELECT
        d.id, d.domain, d.expiration_date,
        c.name, c.email, c.company
      FROM domains d
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = $1
    `;

    try {
      const result = await pool.query(query, [domainId]);
      if (result.rows.length === 0) {
        throw new Error("Domain not found");
      }

      const domain = result.rows[0];
      const daysUntil = Math.ceil(
        (new Date(domain.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      const subject = `Recordatorio: ${domain.domain} vence en ${daysUntil} días`;
      const html = `
        <h2>Hola ${domain.name},</h2>
        <p>Tu dominio <strong>${domain.domain}</strong> vencerá el <strong>${domain.expiration_date}</strong> (${daysUntil} días).</p>
        <p>Renovalo ahora para no perder la disponibilidad.</p>
        <p><a href="https://portal.bitlogic.com.ar/dominios">Renovar en el portal</a></p>
      `;

      const { success, messageId } = await this.sendEmail({
        to: domain.email,
        subject,
        html,
      });

      await logEmail({
        type: "domain_reminder",
        recipient: domain.email,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        clientId: domain.id,
        domainId,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      await logEmail({
        type: "domain_reminder",
        recipient: "unknown",
        subject: "Recordatorio de renovación de dominio",
        status: "failed",
        errorMessage: err.message,
        domainId,
      });

      throw err;
    }
  },

  /**
   * Send test email (for admin testing)
   */
  async testEmail(to) {
    const subject = "Email de prueba - Bitlogic";
    const html = `
      <h2>¡Hola!</h2>
      <p>Este es un email de prueba de Bitlogic.</p>
      <p>Si recibes esto, la configuración SMTP funciona correctamente.</p>
      <p><strong>Enviado a las:</strong> ${new Date().toISOString()}</p>
    `;

    try {
      const { success, messageId } = await this.sendEmail({
        to,
        subject,
        html,
      });

      await logEmail({
        type: "test",
        recipient: to,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      await logEmail({
        type: "test",
        recipient: to,
        subject,
        status: "failed",
        errorMessage: err.message,
      });

      throw err;
    }
  },

  /**
   * List email logs with filtering and pagination
   */
  async listLogs({
    status,
    type,
    recipient,
    page = 1,
    limit = 50,
  } = {}) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (type) {
      conditions.push(`type = $${idx++}`);
      params.push(type);
    }
    if (recipient) {
      conditions.push(`recipient ILIKE $${idx++}`);
      params.push(`%${recipient}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT id, type, recipient, subject, status, error_message, sent_at, created_at
         FROM email_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) FROM email_logs ${where}`, params),
    ]);

    return {
      data: dataRes.rows,
      meta: { page, limit, total: parseInt(countRes.rows[0].count) },
    };
  },
};
