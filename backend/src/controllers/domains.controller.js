import * as domainsService from "../services/domains.service.js";
import { emailService } from "../services/email.service.js";
import { auditService } from "../services/audit.service.js";

export async function listDomains(req, res, next) {
  try {
    const { clientId, serviceId, status, search, expiringInDays, page, limit } = req.query;
    const result = await domainsService.listDomains({
      clientId,
      serviceId,
      status,
      search,
      expiringInDays: expiringInDays ? parseInt(expiringInDays) : null,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 100,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDomain(req, res, next) {
  try {
    const domain = await domainsService.getDomainById(req.params.id);
    if (!domain) return res.status(404).json({ error: { message: "Dominio no encontrado" } });
    res.json(domain);
  } catch (err) {
    next(err);
  }
}

export async function createDomain(req, res, next) {
  try {
    const domain = await domainsService.createDomain(req.body);
    await auditService.logAction({
      user: req.user,
      action: "crear",
      entityType: "dominio",
      entityId: domain.id,
      entityName: domain.domain,
      newValues: req.body,
    });
    res.status(201).json(domain);
  } catch (err) {
    next(err);
  }
}

export async function updateDomain(req, res, next) {
  try {
    const oldDomain = await domainsService.getDomainById(req.params.id);
    const domain = await domainsService.updateDomain(req.params.id, req.body);
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "dominio",
      entityId: domain.id,
      entityName: domain.domain,
      oldValues: oldDomain,
      newValues: req.body,
    });
    res.json(domain);
  } catch (err) {
    next(err);
  }
}

export async function deleteDomain(req, res, next) {
  try {
    const domain = await domainsService.getDomainById(req.params.id);
    await domainsService.softDeleteDomain(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "cancelar",
      entityType: "dominio",
      entityId: req.params.id,
      entityName: domain.domain,
      oldValues: { status: domain.status },
      newValues: { status: "cancelled" },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function renewDomain(req, res, next) {
  try {
    const oldDomain = await domainsService.getDomainById(req.params.id);
    const domain = await domainsService.renewDomain(req.params.id, req.body);
    await auditService.logAction({
      user: req.user,
      action: "renovar",
      entityType: "dominio",
      entityId: domain.id,
      entityName: domain.domain,
      oldValues: { expirationDate: oldDomain.expirationDate },
      newValues: { expirationDate: domain.expirationDate },
    });
    res.json(domain);
  } catch (err) {
    next(err);
  }
}

export async function sendReminder(req, res, next) {
  try {
    await emailService.sendDomainReminderEmail(req.params.id);
    res.json({ message: "Domain reminder email sent" });
  } catch (err) {
    next(err);
  }
}
