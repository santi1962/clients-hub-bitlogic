import { getAdminDashboard } from "../services/dashboard.service.js";

export async function adminDashboard(req, res, next) {
  try {
    const data = await getAdminDashboard();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
