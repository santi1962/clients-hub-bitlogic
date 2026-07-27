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
      // Timeouts explícitos: sin esto, un mailbox que no responde puede
      // dejar colgado el envío (y a quien lo esperó, ej. un request HTTP).
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

// Textos por defecto — usados cuando no hay una plantilla guardada en `email_templates`
// para ese id. Deben reflejar los mismos defaults que src/routes/_admin.plantillas.tsx.
const DEFAULT_TEMPLATES = {
  venc: {
    subject: "Tu servicio {servicio} vence el {fecha}",
    body: "Hola {cliente},\n\nTe recordamos que el servicio {servicio} vence el {fecha} por un monto de {monto}.\n\nPodés abonar desde tu portal: {link_portal}\n\nSaludos,\nEquipo Bitlogic",
  },
  pago_ok: {
    subject: "Recibimos tu pago — {monto}",
    body: "Hola {cliente},\n\nConfirmamos la recepción de tu pago por {monto} correspondiente a {servicio}.\n\n¡Gracias por confiar en nosotros!\n\nBitlogic",
  },
  suspendido: {
    subject: "Suspensión del servicio {servicio}",
    body: "Hola {cliente},\n\nPor falta de pago hemos suspendido temporalmente el servicio {servicio}. Para reactivarlo, regularizá el aviso vencido desde el portal.\n\nBitlogic",
  },
  reactivado: {
    subject: "Servicio {servicio} reactivado",
    body: "Hola {cliente},\n\nTu servicio {servicio} fue reactivado. Disculpá las molestias.\n\nBitlogic",
  },
  dominio: {
    subject: "Tu dominio {dominio} vence pronto",
    body: "Hola {cliente},\n\nEl dominio {dominio} vence el {fecha}. Te recomendamos renovarlo con anticipación para evitar la pérdida.\n\nBitlogic",
  },
};

function fillTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : match));
}

/**
 * Arma subject/html para un template guardado en `email_templates`, con fallback
 * a DEFAULT_TEMPLATES si el admin todavía no lo personalizó desde /plantillas.
 */
async function renderTemplate(templateId, vars) {
  const { rows } = await pool.query(`SELECT subject, body FROM email_templates WHERE id = $1`, [
    templateId,
  ]);
  const template = rows[0] ?? DEFAULT_TEMPLATES[templateId];

  const subject = fillTemplate(template.subject, vars);
  const html = fillTemplate(template.body, vars).replace(/\n/g, "<br>");
  return { subject, html };
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
        c.id AS client_id, c.name, c.email, c.company,
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
      const { subject, html } = await renderTemplate("venc", {
        cliente: notice.name,
        servicio: notice.domain || notice.notice_number,
        fecha: notice.due_date,
        monto: `$${notice.amount}`,
        link_portal: `${config.frontendUrl}/portal/avisos`,
      });

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
        clientId: notice.client_id,
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
        t.id, t.ticket_number, t.subject, c.id AS client_id, c.email, c.name, c.company
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
        clientId: ticket.client_id,
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
        c.id AS client_id, c.name, c.email, c.company
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
      const { subject, html } = await renderTemplate("dominio", {
        cliente: domain.name,
        dominio: domain.domain,
        fecha: domain.expiration_date,
      });

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
        clientId: domain.client_id,
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
   * Send payment received confirmation email to client
   */
  async sendPaymentReceivedEmail(paymentId) {
    const query = `
      SELECT
        p.id, p.amount,
        c.id AS client_id, c.name, c.email, c.company,
        hs.domain
      FROM payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN hosting_services hs ON hs.id = p.hosting_service_id
      WHERE p.id = $1
    `;

    try {
      const result = await pool.query(query, [paymentId]);
      if (result.rows.length === 0) {
        throw new Error("Payment not found");
      }

      const payment = result.rows[0];
      const { subject, html } = await renderTemplate("pago_ok", {
        cliente: payment.name,
        monto: `$${payment.amount}`,
        servicio: payment.domain || payment.company,
      });

      const { success, messageId } = await this.sendEmail({
        to: payment.email,
        subject,
        html,
      });

      await logEmail({
        type: "payment_received",
        recipient: payment.email,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        clientId: payment.client_id,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      await logEmail({
        type: "payment_received",
        recipient: "unknown",
        subject: "Pago recibido",
        status: "failed",
        errorMessage: err.message,
      });
      // No relanzamos: la confirmación de pago es best-effort, no debe romper el flujo de cobranza
      return { success: false };
    }
  },

  /**
   * Send service suspended notice email to client
   */
  async sendServiceSuspendedEmail(serviceId) {
    const query = `
      SELECT
        s.id, s.domain,
        c.id AS client_id, c.name, c.email, c.company
      FROM hosting_services s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = $1
    `;

    try {
      const result = await pool.query(query, [serviceId]);
      if (result.rows.length === 0) {
        throw new Error("Service not found");
      }

      const service = result.rows[0];
      const { subject, html } = await renderTemplate("suspendido", {
        cliente: service.name,
        servicio: service.domain,
      });

      const { success, messageId } = await this.sendEmail({
        to: service.email,
        subject,
        html,
      });

      await logEmail({
        type: "service_suspended",
        recipient: service.email,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        clientId: service.client_id,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      await logEmail({
        type: "service_suspended",
        recipient: "unknown",
        subject: "Servicio suspendido",
        status: "failed",
        errorMessage: err.message,
      });
      return { success: false };
    }
  },

  /**
   * Send service reactivated notice email to client
   */
  async sendServiceReactivatedEmail(serviceId) {
    const query = `
      SELECT
        s.id, s.domain,
        c.id AS client_id, c.name, c.email, c.company
      FROM hosting_services s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = $1
    `;

    try {
      const result = await pool.query(query, [serviceId]);
      if (result.rows.length === 0) {
        throw new Error("Service not found");
      }

      const service = result.rows[0];
      const { subject, html } = await renderTemplate("reactivado", {
        cliente: service.name,
        servicio: service.domain,
      });

      const { success, messageId } = await this.sendEmail({
        to: service.email,
        subject,
        html,
      });

      await logEmail({
        type: "service_reactivated",
        recipient: service.email,
        subject,
        status: success ? "sent" : "failed",
        providerId: messageId,
        clientId: service.client_id,
        sentAt: success ? new Date() : null,
      });

      return { success, messageId };
    } catch (err) {
      await logEmail({
        type: "service_reactivated",
        recipient: "unknown",
        subject: "Servicio reactivado",
        status: "failed",
        errorMessage: err.message,
      });
      return { success: false };
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
