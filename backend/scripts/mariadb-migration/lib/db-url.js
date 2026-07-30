/**
 * Utilidades de seguridad para URLs de conexión (Fase DB-4A). Todas las
 * herramientas del migrador exigen URLs explícitas por flag/env dedicada —
 * ninguna lee `DATABASE_URL` (la variable "productiva" del backend), para
 * que nunca sea posible ejecutar el migrador "sin querer" contra la base
 * activa de un ambiente real.
 */

/** Nunca imprimir la contraseña — solo host/puerto/base, para logs y confirmaciones. */
export function describeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const db = u.pathname.replace(/^\//, "") || "(sin nombre)";
    return `${u.protocol}//${u.hostname}:${u.port || "(default)"}/${db}`;
  } catch {
    return "(URL inválida)";
  }
}

/** Compara origen y destino por host+puerto+base (ignora usuario/contraseña) — para el chequeo "no pueden ser iguales". */
export function sameTarget(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return (
      a.hostname.toLowerCase() === b.hostname.toLowerCase() &&
      (a.port || "") === (b.port || "") &&
      a.pathname === b.pathname
    );
  } catch {
    return false;
  }
}

const SAFE_NAME_HINTS = [
  "test", "dev", "scratch", "tmp", "temp", "descartable",
  "throwaway", "local", "sandbox", "ignorad", "prueba", "migration",
];

/**
 * Heurística de "esto pinta de base descartable" — mismo criterio ya usado
 * por apply-mariadb-schema.mjs desde la Fase DB-2.5. No es una garantía de
 * seguridad real (un nombre no dice nada del contenido), es una barrera
 * contra el error humano más común: pegar la URL equivocada.
 */
export function looksLikeSafeDatabaseName(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const db = u.pathname.replace(/^\//, "").toLowerCase();
    return SAFE_NAME_HINTS.some((hint) => db.includes(hint));
  } catch {
    return false;
  }
}

/** Nunca aceptar que una herramienta de este migrador use la DATABASE_URL productiva del backend por accidente. */
export function assertNotProductionDatabaseUrl(rawUrl, label) {
  const productive = process.env.DATABASE_URL;
  if (productive && rawUrl === productive) {
    throw new Error(
      `${label}: la URL pasada es idéntica a DATABASE_URL (la variable "productiva" del backend). ` +
        `Este migrador nunca debe apuntar ahí implícitamente — pasá la URL de origen/destino explícita por su propio flag.`,
    );
  }
}
