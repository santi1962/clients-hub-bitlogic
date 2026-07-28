import express from "express";
import * as plansController from "../controllers/plans.controller.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireSuperAdmin } from "../middlewares/requireRole.js";

const router = express.Router();

// Lectura SIN restringir a super_admin a propósito: usePlans() la consume
// el portal del cliente (src/routes/portal.index.tsx) y varias pantallas de
// admin/staff para poblar selectores de plan al crear/editar un servicio —
// restringirla rompería el portal. La política de roles de esta fase aplica
// solo a las mutaciones (crear/editar/eliminar definiciones de plan), que sí
// son exclusivas del módulo administrativo de Planes.

// GET /api/hosting/plans
router.get("/", plansController.list);

// GET /api/hosting/plans/:id
router.get("/:id", plansController.get);

// POST /api/hosting/plans — reservado a super_admin, igual que ya asume el
// frontend (PERMISSIONS["planes"] en src/lib/auth.tsx solo incluye super_admin).
router.post("/", authRequired, requireSuperAdmin, plansController.create);

// PATCH /api/hosting/plans/:id
router.patch("/:id", authRequired, requireSuperAdmin, plansController.update);

// DELETE /api/hosting/plans/:id
router.delete("/:id", authRequired, requireSuperAdmin, plansController.remove);

export default router;
