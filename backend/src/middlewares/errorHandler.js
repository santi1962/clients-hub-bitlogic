export function errorHandler(err, req, res, _next) {
  const status = err.status ?? 500;
  const message = err.message ?? "Error interno del servidor";

  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  }

  res.status(status).json({ error: { message } });
}
