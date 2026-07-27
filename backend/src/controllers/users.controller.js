import { usersService } from "../services/users.service.js";

export async function listPortalUsers(req, res) {
  try {
    const users = await usersService.listPortalUsers();
    res.json({ data: users });
  } catch (err) {
    console.error("Error listing portal users:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function createPortalUser(req, res) {
  try {
    const { clientId, name, email, password } = req.body;
    if (!clientId || !email || !password) {
      return res.status(400).json({ error: "clientId, email y password son requeridos" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const user = await usersService.createPortalUser({ clientId, name, email, password });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }
    console.error("Error creating portal user:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const user = await usersService.resetPassword(id, newPassword);
    res.json(user);
  } catch (err) {
    res.status(err.message === "User not found" ? 404 : 500).json({ error: err.message });
  }
}

export async function deletePortalUser(req, res) {
  try {
    const { id } = req.params;
    await usersService.deletePortalUser(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === "User not found" ? 404 : 500).json({ error: err.message });
  }
}
