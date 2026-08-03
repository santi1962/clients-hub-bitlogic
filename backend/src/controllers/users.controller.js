import { usersService } from "../services/users.service.js";
import { emailService } from "../services/email.service.js";

export async function listPortalUsers(req, res, next) {
  try {
    const users = await usersService.listPortalUsers();
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
}

export async function createPortalUser(req, res, next) {
  try {
    const { clientId, name, email, password } = req.body;
    if (!clientId || !email || !password) {
      return res.status(400).json({ error: { message: "clientId, email y password son requeridos" } });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: { message: "La contraseña debe tener al menos 6 caracteres" } });
    }
    const user = await usersService.createPortalUser({ clientId, name, email, password });

    const { success: emailSent } = await emailService.sendPortalInviteEmail({
      to: email,
      name: name || email,
      password,
    });

    res.status(201).json({ ...user, emailSent });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: { message: "Ya existe un usuario con ese email" } });
    }
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: { message: "La contraseña debe tener al menos 6 caracteres" } });
    }
    const user = await usersService.resetPassword(id, newPassword);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function deletePortalUser(req, res, next) {
  try {
    const { id } = req.params;
    await usersService.deletePortalUser(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
