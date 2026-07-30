import mysql from "mysql2/promise";
import config from "../config/index.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("db-pool");

// MariaDB es el único motor soportado. Esta capa existe para no tener que
// tocar los ~156 call sites de pool.query()/pool.connect() esparcidos en el
// backend si alguna vez cambia el driver de bajo nivel (ej. una versión
// futura de mysql2), no para abstraer múltiples motores — eso ya no aplica
// desde la Fase DB-5A (MariaDB-only).
//
// API pública:
//   - pool.query(sql, params) -> Promise<{ rows, rowCount }>
//   - pool.connect() -> Promise<{ query(sql, params), release() }>
//   - pool.on("error", cb)
//   - pool.end() -> Promise<void>
//
// Las transacciones (BEGIN/COMMIT/ROLLBACK) se manejan en todo el código
// como SQL crudo vía client.query("BEGIN"), no con métodos propios de mysql2.

/** Normaliza el resultado de mysql2 ([rows,fields] o ResultSetHeader) a {rows, rowCount}. */
function normalizeMysqlResult(result) {
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  // INSERT/UPDATE/DELETE: mysql2 devuelve un ResultSetHeader con affectedRows
  // en vez de un array de filas.
  return { rows: [], rowCount: result?.affectedRows ?? 0 };
}

// Alinea el código de "entrada duplicada" de mysql2 (errno 1062 /
// ER_DUP_ENTRY) con el código SQLSTATE 23505 (unique_violation) que ya
// chequea el resto del backend (ej. users.controller.js ante un email
// duplicado) — así ese chequeo no depende del motor de base de datos.
function normalizeMysqlError(err) {
  if (err?.errno === 1062 || err?.code === "ER_DUP_ENTRY") {
    err.code = "23505";
  }
  throw err;
}

function createMysqlPool() {
  const rawPool = mysql.createPool({
    uri: config.db.connectionString,
    connectionLimit: 10,
    idleTimeout: 30000,
    connectTimeout: 5000,
    // Fechas siempre en UTC — se convierte a horario de Argentina solo en la
    // capa de presentación.
    timezone: "Z",
    charset: "utf8mb4",
  });

  // NOTA JSON (comprobado contra MariaDB real): a diferencia de MySQL 8, el
  // tipo `JSON` de MariaDB es un alias de LONGTEXT — a nivel de metadata de
  // columna llega como "BLOB", indistinguible de una columna de texto
  // cualquiera. Por eso `pool.query()` NO puede parsear JSON de forma
  // genérica y transparente. Cada service que lea una columna JSON debe
  // parsear el string resultante de forma defensiva (ver auth.service.js
  // formatUser()) — no es un problema de esta capa, es una limitación real
  // del protocolo de MariaDB.

  rawPool.on("error", (err) => {
    log.error("Error en el pool de MariaDB", { err });
  });

  return {
    async query(sql, params) {
      try {
        const [result] = await rawPool.query(sql, params);
        return normalizeMysqlResult(result);
      } catch (err) {
        normalizeMysqlError(err);
      }
    },

    async connect() {
      const conn = await rawPool.getConnection();
      return {
        async query(sql, params) {
          try {
            const [result] = await conn.query(sql, params);
            return normalizeMysqlResult(result);
          } catch (err) {
            normalizeMysqlError(err);
          }
        },
        release() {
          conn.release();
        },
      };
    },

    on(event, cb) {
      rawPool.on(event, cb);
    },

    async end() {
      await rawPool.end();
    },
  };
}

const pool = createMysqlPool();

export default pool;
