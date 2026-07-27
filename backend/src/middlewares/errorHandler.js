import { createLogger } from "../utils/logger.js";

const log = createLogger("error-handler");
const isProduction = process.env.NODE_ENV === "production";

/**
 * Maneja rutas no encontradas. Va montado después de todas las rutas y antes
 * de errorHandler, para que un 404 tenga la misma forma que cualquier otro error.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { message: "Recurso no encontrado" },
    requestId: req.requestId,
  });
}

/**
 * Handler global de errores.
 *
 * Distingue errores operacionales (con `err.status` seteado explícitamente
 * por el código de la app — validaciones, "no encontrado", conflictos, etc.)
 * de errores inesperados (sin `.status`, típicamente un bug o una falla de
 * infraestructura). Los inesperados solo muestran su mensaje real en
 * desarrollo; en producción se responde un mensaje genérico para no filtrar
 * detalles internos (ej. mensajes de error de Postgres), aunque siempre se
 * loguean completos del lado del servidor.
 */
export function errorHandler(err, req, res, _next) {
  const isOperational = typeof err.status === "number";
  const status = isOperational ? err.status : 500;

  const clientMessage = isOperational
    ? err.message
    : isProduction
      ? "Error interno del servidor"
      : err.message ?? "Error interno del servidor";

  if (isOperational) {
    log.warn(`${req.method} ${req.originalUrl} → ${status}`, { requestId: req.requestId, err });
  } else {
    log.error(`${req.method} ${req.originalUrl} → 500`, { requestId: req.requestId, err });
  }

  res.status(status).json({
    error: { message: clientMessage },
    requestId: req.requestId,
  });
}
