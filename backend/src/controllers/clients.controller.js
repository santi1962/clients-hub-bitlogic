import * as clientsService from "../services/clients.service.js";
import { auditService } from "../services/audit.service.js";

export async function list(req, res, next) {
  try {
    const { search, status, page = "1", limit = "100" } = req.query;
    const result = await clientsService.listClients({
      search: search?.trim() || undefined,
      status: status || undefined,
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(200, parseInt(limit) || 100),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    const client = await clientsService.getClientById(req.params.id);
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const client = await clientsService.createClient(req.body ?? {});
    await auditService.logAction({
      user: req.user,
      action: "create",
      entityType: "cliente",
      entityId: client.id,
      entityName: client.company,
      newValues: req.body,
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const oldClient = await clientsService.getClientById(req.params.id);
    const client = await clientsService.updateClient(req.params.id, req.body ?? {});
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "cliente",
      entityId: client.id,
      entityName: client.company,
      oldValues: oldClient,
      newValues: req.body,
    });
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const client = await clientsService.getClientById(req.params.id);
    await clientsService.softDeleteClient(req.params.id);
    await auditService.logAction({
      user: req.user,
      action: "desactivar",
      entityType: "cliente",
      entityId: req.params.id,
      entityName: client.company,
      oldValues: { status: client.status },
      newValues: { status: "inactive" },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
