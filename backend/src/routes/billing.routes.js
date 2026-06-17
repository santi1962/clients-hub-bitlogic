import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireStaff, requireFinancial } from "../middlewares/requireRole.js";
import * as ctrl from "../controllers/billing.controller.js";

const router = Router();

// ── Notices ──────────────────────────────────────────────────
router.get("/notices", authRequired, requireStaff, ctrl.listNotices);
router.post("/notices", authRequired, requireFinancial, ctrl.createNotice);
router.get("/notices/:id", authRequired, requireStaff, ctrl.getNotice);
router.patch("/notices/:id", authRequired, requireFinancial, ctrl.updateNotice);
router.post("/notices/:id/send", authRequired, requireFinancial, ctrl.sendNotice);
router.post("/notices/:id/pdf", authRequired, requireStaff, ctrl.noticePdf);
router.post("/notices/:id/cancel", authRequired, requireFinancial, ctrl.cancelNotice);

// ── Payments ─────────────────────────────────────────────────
router.get("/payments", authRequired, requireStaff, ctrl.listPayments);
router.post("/payments", authRequired, requireFinancial, ctrl.createPayment);
router.get("/payments/:id", authRequired, requireStaff, ctrl.getPayment);
router.patch("/payments/:id", authRequired, requireFinancial, ctrl.updatePayment);
router.post("/payments/:id/mark-paid", authRequired, requireFinancial, ctrl.markPaid);

// ── Summaries ─────────────────────────────────────────────────
router.get("/clients/:clientId/summary", authRequired, requireStaff, ctrl.clientSummary);
router.get("/summary", authRequired, requireStaff, ctrl.globalSummary);

export default router;
