/**
 * Email Controller
 */
import { emailService } from "../services/email.service.js";

export async function testEmail(req, res, next) {
  try {
    const { to } = req.body;

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: { message: "Invalid email address" } });
    }

    const result = await emailService.testEmail(to);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listLogs(req, res, next) {
  try {
    const { status, type, recipient, page = "1", limit = "50" } = req.query;
    res.json(
      await emailService.listLogs({
        status: status || undefined,
        type: type || undefined,
        recipient: recipient || undefined,
        page: Math.max(1, parseInt(page) || 1),
        limit: Math.min(200, parseInt(limit) || 50),
      }),
    );
  } catch (err) {
    next(err);
  }
}
