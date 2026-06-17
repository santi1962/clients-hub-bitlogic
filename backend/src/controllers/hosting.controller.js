import * as hostingService from "../services/hosting.service.js";
import { hestiaService } from "../services/hestia.service.js";
import { auditService } from "../services/audit.service.js";

// ── Plans ─────────────────────────────────────────────────────
export async function listPlans(req, res, next) {
  try {
    res.json(await hostingService.listPlans());
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req, res, next) {
  try {
    res.status(201).json(await hostingService.createPlan(req.body ?? {}));
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(req, res, next) {
  try {
    res.json(await hostingService.updatePlan(req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
}

// ── Services ──────────────────────────────────────────────────
export async function listServices(req, res, next) {
  try {
    const { clientId, planId, search, status, page = "1", limit = "100" } = req.query;
    res.json(
      await hostingService.listServices({
        clientId: clientId || undefined,
        planId: planId || undefined,
        search: search?.trim() || undefined,
        status: status || undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(200, parseInt(limit) || 100),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getService(req, res, next) {
  try {
    res.json(await hostingService.getServiceById(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createService(req, res, next) {
  try {
    res.status(201).json(await hostingService.createService(req.body ?? {}));
  } catch (err) {
    next(err);
  }
}

export async function updateService(req, res, next) {
  try {
    res.json(await hostingService.updateService(req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
}

export async function suspendService(req, res, next) {
  try {
    res.json(await hostingService.suspendService(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function reactivateService(req, res, next) {
  try {
    res.json(await hostingService.reactivateService(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function changePlan(req, res, next) {
  try {
    const { planId } = req.body ?? {};
    res.json(await hostingService.changeServicePlan(req.params.id, planId));
  } catch (err) {
    next(err);
  }
}

export async function syncHestia(req, res, next) {
  try {
    const { hestiaUsername } = req.body ?? {};

    if (!hestiaUsername) {
      return res.status(400).json({ error: "hestiaUsername required" });
    }

    const service = await hostingService.getServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get data from HestiaCP
    const stats = await hestiaService.getUserStats(hestiaUsername);
    const domains = await hestiaService.listUserDomains(hestiaUsername);

    // Update service with Hestia data
    const updatedService = await hostingService.updateService(req.params.id, {
      hestiaUsername,
      storageUsedGb: Math.ceil(stats.diskUsed / 1024), // Convert MB to GB
      hestiaUrl: service.hestiaUrl, // Keep existing URL
    });

    // Log the sync action
    await auditService.logAction({
      user: req.user,
      action: "sincronizar",
      entityType: "servicio",
      entityId: req.params.id,
      entityName: service.domain,
      newValues: {
        hestiaUsername,
        storageUsedGb: updatedService.storageUsedGb,
        domainCount: domains.length,
      },
    });

    res.json({
      service: updatedService,
      stats,
      domains,
      message: "Service synced with HestiaCP",
    });
  } catch (err) {
    next(err);
  }
}
