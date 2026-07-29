/**
 * Audit Controller
 */
import { auditService } from "../services/audit.service.js";

export async function listLogs(req, res, next) {
  try {
    const { entityType, entityId, userId, action, dateFrom, dateTo, page = "1", limit = "50" } = req.query;
    res.json(
      await auditService.listLogs({
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        userId: userId || undefined,
        action: action || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(200, parseInt(limit) || 50),
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getLog(req, res, next) {
  try {
    res.json(await auditService.getLogById(req.params.id));
  } catch (err) {
    next(err);
  }
}
