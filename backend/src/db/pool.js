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

// Traduce placeholders posicionales `?` (la sintaxis que usan las queries ya
// convertidas a MariaDB, ej. el dominio auth/users) a `$1,$2,...` para
// Postgres. Si la query ya usa `$N` (módulos todavía no convertidos), se
// devuelve intacta — así este helper convive con el resto del backend sin
// tocarlo. No es un parser SQL genérico: es un reemplazo mecánico por orden
// de aparición, pensado para queries controladas escritas a mano por este
// equipo, no contempla un `?` literal dentro de un string o comentario SQL
// (ninguna de las queries convertidas hasta ahora lo tiene).
function toPostgresPlaceholders(sql) {
  if (/\$\d/.test(sql)) return sql;
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

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
  // nativos, connect()/release(), on(), end()). Se envuelven únicamente
  // query()/connect().query() para traducir placeholders `?` — el resto del
  // comportamiento queda idéntico al de antes de la Fase DB-3A.
  const originalQuery = pgPool.query.bind(pgPool);
  pgPool.query = (sql, params) => originalQuery(toPostgresPlaceholders(sql), params);

  // OJO: `pg.Pool.prototype.connect` se usa en dos estilos. La app solo usa
  // el estilo Promise (`const client = await pool.connect()`, transacciones
  // manuales) — ahí sí hace falta traducir placeholders, porque el caller
  // manda `?` directo a client.query(). Pero `pg` internamente también
  // llama a `this.connect(callback)` en estilo callback desde su propio
  // pool.query() de alto nivel — ese texto YA pasó por toPostgresPlaceholders
  // en el pgPool.query de arriba, así que ese camino interno debe quedar
  // intacto. Envolver ambos casos igual (como en la primera versión de este
  // archivo) rompía ese uso interno: el callback nunca se invocaba y
  // pool.query() se quedaba colgado esperando para siempre (confirmado con
  // la suite de tests — health.test.js colgaba en el chequeo real de DB).
  const originalConnect = pgPool.connect.bind(pgPool);
  pgPool.connect = (callback) => {
    if (typeof callback === "function") {
      return originalConnect(callback);
    }
    return originalConnect().then((client) => {
      const originalClientQuery = client.query.bind(client);
      client.query = (sql, params) => originalClientQuery(toPostgresPlaceholders(sql), params);
      return client;
    });
  };

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

// Alinea el código de "entrada duplicada" de mysql2 (errno 1062 /
// ER_DUP_ENTRY) con el código SQLSTATE que ya usa Postgres (23505,
// unique_violation) — es el único código de error que el backend
// efectivamente chequea hoy (ej. users.controller.js ante un email
// duplicado), así que se normaliza solo ese, sin construir una tabla
// genérica de mapeo de errores que nadie usa todavía.
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
    // Fechas siempre en UTC — TIMESTAMPTZ de Postgres no tiene equivalente
    // nativo en MariaDB, la política elegida es guardar todo en UTC y
    // convertir a horario de Argentina solo en la capa de presentación.
    timezone: "Z",
  });

  // NOTA JSON (comprobado contra MariaDB real): a diferencia de MySQL 8, el
  // tipo `JSON` de MariaDB es un alias de LONGTEXT — a nivel de metadata de
  // columna llega como "BLOB", indistinguible de una columna de texto
  // cualquiera. Por eso `pool.query()` NO puede parsear JSON de forma
  // genérica y transparente para MariaDB (sí lo hace `pg` para jsonb/json en
  // Postgres). Cada service que lea una columna JSON debe parsear el string
  // resultante de forma defensiva (ver auth.service.js formatUser()) — no es
  // un problema de esta capa de compatibilidad, es una limitación real del
  // protocolo de MariaDB.

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

const driver = config.db.driver;

if (driver === "mysql") {
  log.warn(
    "db-pool: DATABASE_URL usa esquema mysql:// — driver MariaDB activo. Las queries del backend siguen escritas en sintaxis PostgreSQL y NO son compatibles todavía (Fase DB-1, sin conversión de queries).",
  );
}

const pool = driver === "mysql" ? createMysqlPool() : createPostgresPool();

export default pool;
