import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { statSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db/pool.js";
import { authRequired } from "../middlewares/authRequired.js";
import { requireAdmin } from "../middlewares/requireRole.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "../../../backups");

if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

const router = Router();

router.get("/", authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, size_mb, status, notes, created_at
       FROM backups ORDER BY created_at DESC LIMIT 50`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", authRequired, async (req, res, next) => {
  const { notes } = req.body ?? {};
  const now = new Date();
  const filename = `backup_${now.toISOString().replace(/[:.]/g, "-")}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  // Insert "in_progress" record first
  const { rows } = await pool.query(
    `INSERT INTO backups (name, type, status, notes, file_path)
     VALUES ($1, 'database', 'in_progress', $2, $3)
     RETURNING id`,
    [`Backup BD ${now.toLocaleDateString("es-AR")}`, notes || "Backup bajo demanda", filePath],
  );
  const backupId = rows[0].id;

  // Respond immediately, run pg_dump in background
  res.status(202).json({ id: backupId, status: "in_progress" });

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL no configurada");

    await execAsync(`pg_dump "${dbUrl}" -f "${filePath}" --no-password`);

    const sizeMb = statSync(filePath).size / (1024 * 1024);
    await pool.query(
      `UPDATE backups SET status = 'success', size_mb = $2 WHERE id = $1`,
      [backupId, sizeMb.toFixed(2)],
    );
  } catch (err) {
    await pool.query(
      `UPDATE backups SET status = 'failed', notes = $2 WHERE id = $1`,
      [backupId, err.message],
    ).catch(() => {});
  }
});

router.get("/:id/download", authRequired, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, file_path, status FROM backups WHERE id = $1`,
      [req.params.id],
    );
    const backup = rows[0];
    if (!backup) return res.status(404).json({ error: { message: "Backup no encontrado" } });
    if (backup.status !== "success") {
      return res.status(409).json({ error: { message: "El backup no terminó correctamente" } });
    }
    if (!backup.file_path || !existsSync(backup.file_path)) {
      return res.status(404).json({ error: { message: "Archivo de backup no encontrado en disco" } });
    }
    res.download(backup.file_path, `${backup.name}.sql`);
  } catch (err) {
    next(err);
  }
});

export default router;
