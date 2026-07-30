/**
 * Transformaciones de valores para la migración de datos reales
 * PostgreSQL -> MariaDB (Fase DB-4A). Puras (sin I/O), reusadas por
 * export-postgres.mjs (al serializar a NDJSON) e import-mariadb.mjs (al
 * armar los parámetros del INSERT) — así ambos lados aplican EXACTAMENTE
 * la misma regla, sin duplicar lógica.
 *
 * Principio general: preservar el valor exacto de Postgres, no
 * "interpretarlo" — un NUMERIC nunca pasa por parseFloat/Number (pierde
 * precisión), un timestamp nunca se recalcula a otra zona horaria salvo
 * normalizarlo a UTC explícito.
 */
import { createHash } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID: se valida el formato y se devuelve tal cual (string exacto, sin normalizar mayúsculas). */
export function transformUuid(value) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (!UUID_RE.test(str)) {
    throw new Error(`Valor no es un UUID válido: "${str}"`);
  }
  return str;
}

/**
 * NUMERIC/DECIMAL: el driver `pg` con este proyecto ya devuelve NUMERIC
 * como string (no hay `pg.types.setTypeParser` para el OID 1700 en
 * `db/pool.js`) — se preserva tal cual, nunca se pasa por `Number()`, que
 * redondearía valores de precisión alta (ej. `"123.10"` -> `123.1`, se
 * pierde el cero final; o peor, un valor fuera del rango seguro de float64).
 */
export function transformNumeric(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** TIMESTAMPTZ -> ISO 8601 en UTC explícito (sufijo Z), formato que mysql2 acepta directo. */
export function transformTimestamp(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Valor no es una fecha válida: "${value}"`);
  }
  return date.toISOString();
}

/** DATE (sin hora): YYYY-MM-DD, sin aplicar ninguna zona horaria (evita el corrimiento de día del driver). */
export function transformDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Valor no es una fecha válida: "${value}"`);
  }
  return date.toISOString().slice(0, 10);
}

/** JSONB: se valida que sea JSON serializable y se devuelve como STRING (NDJSON no anida objetos por columna). */
export function transformJson(value) {
  if (value === null || value === undefined) return null;
  const obj = typeof value === "string" ? JSON.parse(value) : value;
  return JSON.stringify(obj);
}

/** BOOLEAN: `pg` ya da true/false nativo; se preserva como boolean real (no 0/1) en el NDJSON intermedio. */
export function transformBoolean(value) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

/** Texto: passthrough — Node ya maneja UTF-8 nativamente (tildes/ñ/emoji sobreviven sin tocar bytes). */
export function transformText(value) {
  return value === undefined ? null : value;
}

/** sha256 en hex de un buffer o string — usado para checksums de archivos NDJSON y del manifest. */
export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Normaliza un DECIMAL/NUMERIC string para comparación semántica (no
 * textual): "100.10" y "100.1" son el mismo valor, pero distintos como
 * string. Usado solo por validate-migration.mjs, nunca durante el
 * export/import real (donde el string exacto de Postgres se preserva).
 */
export function normalizeDecimalForComparison(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) throw new Error(`No es un decimal válido: "${value}"`);
  return num.toFixed(2);
}
