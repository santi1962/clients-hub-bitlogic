import { Router } from "express";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin, requireStaff } from "../middlewares/requireRole.js";
import {
  listDomains,
  getDomain,
  createDomain,
  updateDomain,
  deleteDomain,
  renewDomain,
  sendReminder,
} from "../controllers/domains.controller.js";

const router = Router();

router.get("/", authRequired, requireStaff, listDomains);
router.post("/", authRequired, requireAdmin, createDomain);
router.get("/:id", authRequired, requireStaff, getDomain);
router.patch("/:id", authRequired, requireAdmin, updateDomain);
router.delete("/:id", authRequired, requireAdmin, deleteDomain);
router.post("/:id/renew", authRequired, requireAdmin, renewDomain);
router.post("/:id/send-reminder", authRequired, requireStaff, sendReminder);

export default router;
