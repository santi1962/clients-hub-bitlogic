import { randomUUID } from "crypto";

const HEADER = "x-request-id";
// Solo aceptamos el id entrante si tiene forma de UUID, para no inyectar texto
// arbitrario en los logs. El único proxy delante del backend es el Nginx del
// propio VPS (ver DEPLOYMENT_GUIDE.md), así que se lo trata como confiable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Asigna un id único por request (propio o heredado de un proxy confiable). */
export function requestId(req, res, next) {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === "string" && UUID_RE.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
