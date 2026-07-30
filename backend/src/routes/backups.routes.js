import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { statSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import os from "os";
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

// Ejecuta el dump real contra el motor activo. `--defaults-extra-file` (chmod
// 0600, archivo temporal) evita que la contraseña aparezca en la línea de
// comandos — visible vía `ps`/Task Manager si se pasara como argumento
// directo (`-p...`). Se borra el archivo temporal en el `finally`, incluso
// si el dump falla.
async function runMysqlDump(dbUrl, filePath) {
  const parsed = new URL(dbUrl);
  const dbName = parsed.pathname.replace(/^\//, "");
  const tmpIniPath = path.join(os.tmpdir(), `bitlogic-backup-${randomUUID()}.cnf`);
  const iniContent =
    `[client]\n` +
    `user=${decodeURIComponent(parsed.username || "root")}\n` +
    `password=${decodeURIComponent(parsed.password || "")}\n` +
    `host=${parsed.hostname}\n` +
    `port=${parsed.port || 3306}\n`;

  writeFileSync(tmpIniPath, iniContent, { mode: 0o600 });
  try {
    const bin = await pickMariadbDumpBinary();
    await execAsync(`${bin} --defaults-extra-file="${tmpIniPath}" "${dbName}" > "${filePath}"`);
  } finally {
    try {
      unlinkSync(tmpIniPath);
    } catch {
      // ya borrado o inaccesible — no hay credenciales que proteger si no existe
    }
  }
}

let cachedDumpBinary = null;
// `mariadb-dump` es el binario oficial en MariaDB 10.5+; `mysqldump` es el
// alias histórico que sigue empaquetado (y el único presente en instalaciones
// más viejas, ej. XAMPP). Se prueba el primero y se cae al segundo — no se
// asume cuál está en el PATH del servidor.
async function pickMariadbDumpBinary() {
  if (cachedDumpBinary) return cachedDumpBinary;
  try {
    await execAsync("mariadb-dump --version");
    cachedDumpBinary = "mariadb-dump";
  } catch {
    cachedDumpBinary = "mysqldump";
  }
  return cachedDumpBinary;
}

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

  // UUID v4 generado en la app (política definitiva, Fase DB-3K) — antes
  // dependía del DEFAULT (UUID()) de la columna, retirado en esta fase.
  const backupId = randomUUID();

  // Insert "in_progress" record first
  await pool.query(
    `INSERT INTO backups (id, name, type, status, notes, file_path)
     VALUES (?, ?, 'database', 'in_progress', ?, ?)`,
    [backupId, `Backup BD ${now.toLocaleDateString("es-AR")}`, notes || "Backup bajo demanda", filePath],
  );

  // Respond immediately, run the dump in background
  res.status(202).json({ id: backupId, status: "in_progress" });

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL no configurada");

    await runMysqlDump(dbUrl, filePath);

    const sizeMb = statSync(filePath).size / (1024 * 1024);
    await pool.query(
      `UPDATE backups SET status = 'success', size_mb = ? WHERE id = ?`,
      [sizeMb.toFixed(2), backupId],
    );
  } catch (err) {
    await pool.query(
      `UPDATE backups SET status = 'failed', notes = ? WHERE id = ?`,
      [err.message, backupId],
    ).catch(() => {});
  }
});

router.get("/:id/download", authRequired, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, file_path, status FROM backups WHERE id = ?`,
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
