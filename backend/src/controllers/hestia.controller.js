/**
 * HestiaCP Controller
 * Handles requests to HestiaCP integration endpoints
 */
import { hestiaService } from "../services/hestia.service.js";
import config from "../config/index.js";

export async function debugConfig(req, res, next) {
  try {
    res.json({
      hestia: {
        url: config.hestia.url,
        username: config.hestia.username,
        verifySsl: config.hestia.verifySsl,
        passwordConfigured: !!config.hestia.password,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function testStatus(req, res, next) {
  try {
    const status = await hestiaService.testConnection();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await hestiaService.listUsers();
    res.json({ data: users, meta: { total: users.length } });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const { username } = req.params;
    const user = await hestiaService.getUser(username);
    const domains = await hestiaService.listUserDomains(username);
    const stats = await hestiaService.getUserStats(username);

    res.json({
      user,
      domains,
      stats,
    });
  } catch (err) {
    next(err);
  }
}
