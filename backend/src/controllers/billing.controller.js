import * as billingService from "../services/billing.service.js";
import { emailService } from "../services/email.service.js";
import { auditService } from "../services/audit.service.js";

// Status map: frontend Spanish → backend English
const NOTICE_STATUS_TO_DB = {
  borrador: "draft",
  pendiente: "pending",
  enviado: "sent",
  pagado: "paid",
  vencido: "overdue",
  cancelado: "cancelled",
};
const PAYMENT_STATUS_TO_DB = {
  pendiente: "pending",
  pagado: "paid",
  vencido: "overdue",
  cancelado: "cancelled",
};
const METHOD_TO_DB = {
  Manual: "manual",
  Transferencia: "transfer",
  Efectivo: "cash",
  MercadoPago: "mercadopago",
  "Mercado Pago": "mercadopago",
  PayPal: "paypal",
};

const dbStatus = (map, val) => (val ? (map[val] ?? val) : undefined);

// ── Notices ──────────────────────────────────────────────────
export async function listNotices(req, res, next) {
  try {
    const { clientId, serviceId, status, search, page = "1", limit = "50" } = req.query;
    res.json(
      await billingService.listNotices({
        clientId: clientId || undefined,
        serviceId: serviceId || undefined,
        status: dbStatus(NOTICE_STATUS_TO_DB, status),
        search: search?.trim() || undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(200, parseInt(limit) || 50),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getNotice(req, res, next) {
  try {
    res.json(await billingService.getNoticeById(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createNotice(req, res, next) {
  try {
    const { clientId, hostingServiceId, periodMonth, periodYear, dueDate, amount, notes } =
      req.body ?? {};
    const notice = await billingService.createNotice({
      clientId,
      hostingServiceId,
      periodMonth: parseInt(periodMonth),
      periodYear: parseInt(periodYear),
      dueDate,
      amount: amount ? parseFloat(amount) : undefined,
      notes,
    });
    await auditService.logAction({
      user: req.user,
      action: "crear",
      entityType: "aviso",
      entityId: notice.id,
      entityName: notice.noticeNumber,
      newValues: req.body,
    });
    res.status(201).json(notice);
  } catch (err) {
    next(err);
  }
}

export async function updateNotice(req, res, next) {
  try {
    res.json(await billingService.updateNotice(req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
}

export async function sendNotice(req, res, next) {
  try {
    const noticeId = req.params.id;
    const notice = await billingService.getNoticeById(noticeId);

    // Send email first
    await emailService.sendPaymentNoticeEmail(noticeId);

    // Only mark as sent if email succeeded
    const sentNotice = await billingService.sendNotice(noticeId);
    await auditService.logAction({
      user: req.user,
      action: "enviar",
      entityType: "aviso",
      entityId: noticeId,
      entityName: notice.noticeNumber,
      oldValues: { status: notice.status },
      newValues: { status: "sent" },
    });
    res.json({ ...sentNotice, message: "Aviso enviado" });
  } catch (err) {
    next(err);
  }
}

export async function noticePdf(req, res, next) {
  try {
    const pdfBuffer = await billingService.generateNoticePdf(req.params.id);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="aviso-${req.params.id}.pdf"`);
    res.set("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function cancelNotice(req, res, next) {
  try {
    const notice = await billingService.getNoticeById(req.params.id);
    const cancelledNotice = await billingService.cancelNotice(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "cancelar",
      entityType: "aviso",
      entityId: req.params.id,
      entityName: notice.noticeNumber,
      oldValues: { status: notice.status },
      newValues: { status: "cancelled" },
    });
    res.json(cancelledNotice);
  } catch (err) {
    next(err);
  }
}

export async function deleteNotice(req, res, next) {
  try {
    const notice = await billingService.getNoticeById(req.params.id);
    await billingService.deleteNotice(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "eliminar",
      entityType: "aviso",
      entityId: req.params.id,
      entityName: notice.noticeNumber,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── Payments ─────────────────────────────────────────────────
export async function listPayments(req, res, next) {
  try {
    const {
      clientId,
      serviceId,
      status,
      method,
      periodMonth,
      periodYear,
      page = "1",
      limit = "50",
    } = req.query;
    res.json(
      await billingService.listPayments({
        clientId: clientId || undefined,
        serviceId: serviceId || undefined,
        status: dbStatus(PAYMENT_STATUS_TO_DB, status),
        method: dbStatus(METHOD_TO_DB, method),
        periodMonth: periodMonth ? parseInt(periodMonth) : undefined,
        periodYear: periodYear ? parseInt(periodYear) : undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(200, parseInt(limit) || 50),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getPayment(req, res, next) {
  try {
    res.json(await billingService.getPaymentById(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createPayment(req, res, next) {
  try {
    const {
      clientId,
      hostingServiceId,
      paymentNoticeId,
      periodMonth,
      periodYear,
      amount,
      method,
      paidAt,
      reference,
      internalNotes,
    } = req.body ?? {};
    const payment = await billingService.createPayment({
      clientId,
      hostingServiceId,
      paymentNoticeId,
      periodMonth: parseInt(periodMonth),
      periodYear: parseInt(periodYear),
      amount: parseFloat(amount),
      method: dbStatus(METHOD_TO_DB, method) ?? "manual",
      paidAt,
      reference,
      internalNotes,
    });
    await auditService.logAction({
      user: req.user,
      action: "crear",
      entityType: "pago",
      entityId: payment.id,
      entityName: `${periodMonth}/${periodYear}`,
      newValues: req.body,
    });
    if (payment.status === "paid") {
      emailService.sendPaymentReceivedEmail(payment.id).catch(() => {});
    }
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

export async function updatePayment(req, res, next) {
  try {
    const oldPayment = await billingService.getPaymentById(req.params.id);
    const payment = await billingService.updatePayment(req.params.id, req.body ?? {});
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "pago",
      entityId: req.params.id,
      entityName: `${oldPayment.periodMonth}/${oldPayment.periodYear}`,
      oldValues: oldPayment,
      newValues: req.body,
    });
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

export async function deletePayment(req, res, next) {
  try {
    const oldPayment = await billingService.getPaymentById(req.params.id);
    await billingService.deletePayment(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "eliminar",
      entityType: "pago",
      entityId: req.params.id,
      entityName: `${oldPayment.periodMonth}/${oldPayment.periodYear}`,
      oldValues: oldPayment,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function markPaid(req, res, next) {
  try {
    const oldPayment = await billingService.getPaymentById(req.params.id);
    const payment = await billingService.markPaid(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "marcar pagado",
      entityType: "pago",
      entityId: req.params.id,
      entityName: `${oldPayment.periodMonth}/${oldPayment.periodYear}`,
      oldValues: { status: oldPayment.status },
      newValues: { status: "paid" },
    });
    emailService.sendPaymentReceivedEmail(payment.id).catch(() => {});
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

// ── Summaries ─────────────────────────────────────────────────
export async function clientSummary(req, res, next) {
  try {
    res.json(await billingService.getClientSummary(req.params.clientId));
  } catch (err) {
    next(err);
  }
}

export async function globalSummary(req, res, next) {
  try {
    res.json(await billingService.getGlobalSummary());
  } catch (err) {
    next(err);
  }
}
