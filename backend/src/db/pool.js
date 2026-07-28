import pg from "pg";
import mysql from "mysql2/promise";
import config from "../config/index.js";
import { createLogger } from "../utils/logger.js";

const { Pool } = pg;
const log = createLogger("db-pool");

// Capa de compatibilidad: expone la misma API sin importar el motor real
// detrás (Postgres hoy, MariaDB a futuro), para no tener que tocar los ~156
// call sites de pool.query()/pool.connect() esparcidos en el backend cuando
// se convierta el motor. Ver docs de la Fase DB-1 de la migración a MariaDB.
//
// API pública (igual en ambos drivers):
//   - pool.query(sql, params) -> Promise<{ rows, rowCount }>
//   - pool.connect() -> Promise<{ query(sql, params), release() }>
//   - pool.on("error", cb)
//   - pool.end() -> Promise<void>
//
// Las transacciones (BEGIN/COMMIT/ROLLBACK) ya se manejan en todo el código
// como SQL crudo vía client.query("BEGIN"), no con métodos propios de `pg` —
// eso funciona igual contra `mysql2`, así que no hace falta modelarlas acá.

function createPostgresPool() {
  const pgPool = new Pool({
    connectionString: config.db.connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: "bitlogic-backend",
  });

  // No hay listener "connect" que fuerce SET client_encoding: esta base ya
  // negocia UTF8 por default (verificado con `SHOW client_encoding`), así que
  // esa query era redundante. Además era la causa confirmada del warning de
  // pg "Calling client.query() when the client is already executing a query"
  // — el pool entregaba el client al caller original mientras esa query sin
  // esperar todavía estaba en vuelo sobre el mismo client.

  pgPool.on("error", (err) => {
    // Errores de conexiones ociosas en el pool (ej. la DB las cierra). No es
    // fatal: pg descarta esa conexión y crea una nueva en el próximo query.
    log.error("Error en el pool de PostgreSQL", { err });
  });

  // `pg.Pool` ya expone exactamente la API que necesitamos (rows/rowCount
  // nativos, connect()/release(), on(), end()) — se devuelve tal cual, sin
  // envolver nada, para no cambiar en absoluto el comportamiento actual.
  return pgPool;
}

/** Normaliza el resultado de mysql2 ([rows,fields] o ResultSetHeader) al shape {rows, rowCount} de pg. */
function normalizeMysqlResult(result) {
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  // INSERT/UPDATE/DELETE: mysql2 devuelve un ResultSetHeader con affectedRows
  // en vez de un array de filas; pg en cambio siempre da rowCount + rows (con
  // rows=[] si no hay RETURNING). Igual shape acá para no romper callers.
  return { rows: [], rowCount: result?.affectedRows ?? 0 };
}

function createMysqlPool() {
  const rawPool = mysql.createPool({
    uri: config.db.connectionString,
    connectionLimit: 10,
    idleTimeout: 30000,
    connectTimeout: 5000,
    // Fechas siempre en UTC — TIMESTAMPTZ de Postgres no tiene equivalente
    // nativo en MariaDB, la política elegida es guardar todo en UTC y
    // convertir a horario de Argentina solo en la capa de presentación.
    timezone: "Z",
  });

  rawPool.on("error", (err) => {
    log.error("Error en el pool de MariaDB", { err });
  });

  return {
    async query(sql, params) {
      const [result] = await rawPool.query(sql, params);
      return normalizeMysqlResult(result);
    },

    async connect() {
      const conn = await rawPool.getConnection();
      return {
        async query(sql, params) {
          const [result] = await conn.query(sql, params);
          return normalizeMysqlResult(result);
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

const driver = config.db.driver;

if (driver === "mysql") {
  log.warn(
    "db-pool: DATABASE_URL usa esquema mysql:// — driver MariaDB activo. Las queries del backend siguen escritas en sintaxis PostgreSQL y NO son compatibles todavía (Fase DB-1, sin conversión de queries).",
  );
}

const pool = driver === "mysql" ? createMysqlPool() : createPostgresPool();

export default pool;
