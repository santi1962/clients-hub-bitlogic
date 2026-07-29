import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ticketUploadsDir = path.join(__dirname, "../../uploads/tickets");
// Igual patrón que settings.routes.js (uploads/logos): el directorio no está
// versionado y no existe en un checkout nuevo — sin esto, multer.diskStorage
// falla con ENOENT en el primer upload real.
if (!fs.existsSync(ticketUploadsDir)) fs.mkdirSync(ticketUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ticketUploadsDir),
  filename: (_req, file, cb) => {
    // El nombre en disco lo genera el servidor — nunca se usa el nombre que
    // manda el cliente, para evitar colisiones y cualquier intento de path
    // traversal a través del nombre de archivo original.
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|application\/pdf|audio\/(webm|mp4|ogg|mpeg))$/;

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB por archivo
    files: 1, // un adjunto por mensaje
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido. Solo imágenes, PDF y audio."));
    }
  },
});

/**
 * Middleware de subida de un adjunto de ticket. Misma política (tipo,
 * tamaño, cantidad) para el panel de staff y para el portal de clientes —
 * antes el staff no tenía fileFilter y podía subir cualquier tipo de archivo.
 * Normaliza los errores de multer (tipo no permitido, tamaño excedido) a 400
 * en vez de dejarlos caer como 500 genérico en el handler global de errores.
 */
export function ticketAttachmentUpload(req, res, next) {
  multerUpload.single("file")(req, res, (err) => {
    if (err) {
      err.status = 400;
      return next(err);
    }
    next();
  });
}
