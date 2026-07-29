import * as plansService from "../services/plans.service.js";
import { auditService } from "../services/audit.service.js";

const PLACEHOLDER_KEYWORDS = ["demo", "test", "fake", "placeholder", "example", "sample"];

function containsPlaceholder(value) {
  if (!value || typeof value !== "string") return false;
  return PLACEHOLDER_KEYWORDS.some((keyword) =>
    value.toLowerCase().includes(keyword),
  );
}

/**
 * GET /api/hosting/plans
 */
export async function list(req, res, next) {
  try {
    const { status, limit = "100" } = req.query;
    const result = await plansService.listPlans({
      status,
      limit: Math.min(200, parseInt(limit) || 100),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/hosting/plans/:id
 */
export async function get(req, res, next) {
  try {
    const plan = await plansService.getPlanById(req.params.id);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/hosting/plans
 * Body: { name, description, storage_gb, websites_limit, emails_limit, monthly_price, status }
 */
export async function create(req, res, next) {
  try {
    const { name, storageGb, monthlyPrice } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: { code: "INVALID_NAME", message: "El nombre del plan es requerido" },
      });
    }

    if (containsPlaceholder(name)) {
      return res.status(400).json({
        error: {
          code: "PLACEHOLDER_DETECTED",
          message: "No se permiten nombres de ejemplo o placeholder",
        },
      });
    }

    if (!monthlyPrice || monthlyPrice <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_PRICE",
          message: "El precio mensual es requerido y debe ser mayor a 0",
        },
      });
    }

    if (storageGb !== undefined && storageGb < 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_STORAGE",
          message: "El espacio debe ser mayor o igual a 0",
        },
      });
    }

    const plan = await plansService.createPlan(req.body);
    await auditService.logAction({
      user: req.user,
      requestId: req.requestId,
      action: "crear",
      entityType: "plan_hosting",
      entityId: plan.id,
      entityName: plan.name,
      newValues: req.body,
    });
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/hosting/plans/:id
 */
export async function update(req, res, next) {
  try {
    if (req.body.name && containsPlaceholder(req.body.name)) {
      return res.status(400).json({
        error: {
          code: "PLACEHOLDER_DETECTED",
          message: "No se permiten nombres de ejemplo",
        },
      });
    }

    if (req.body.monthly_price !== undefined && req.body.monthly_price <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_PRICE",
          message: "El precio mensual debe ser mayor a 0",
        },
      });
    }

    const oldPlan = await plansService.getPlanById(req.params.id);
    const plan = await plansService.updatePlan(req.params.id, req.body);
    await auditService.logAction({
      user: req.user,
      requestId: req.requestId,
      action: "editar",
      entityType: "plan_hosting",
      entityId: plan.id,
      entityName: plan.name,
      oldValues: oldPlan,
      newValues: req.body,
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/hosting/plans/:id
 */
export async function remove(req, res, next) {
  try {
    const plan = await plansService.getPlanById(req.params.id);
    await plansService.deletePlan(req.params.id);
    await auditService.logAction({
      user: req.user,
      requestId: req.requestId,
      action: "eliminar",
      entityType: "plan_hosting",
      entityId: req.params.id,
      entityName: plan.name,
      oldValues: plan,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
