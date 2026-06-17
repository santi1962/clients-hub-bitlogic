import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin, requireStaff } from "../middlewares/requireRole.js";
import * as ctrl from "../controllers/clients.controller.js";

const router = Router();

router.get("/", authRequired, requireStaff, ctrl.list);
router.post("/", authRequired, requireAdmin, ctrl.create);
router.get("/:id", authRequired, requireStaff, ctrl.get);
router.patch("/:id", authRequired, requireAdmin, ctrl.update);
router.delete("/:id", authRequired, requireAdmin, ctrl.remove);

export default router;
