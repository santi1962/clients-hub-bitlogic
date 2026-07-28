import pg from "pg";
import config from "../config/index.js";
import { createLogger } from "../utils/logger.js";

const { Pool } = pg;
const log = createLogger("db-pool");

const pool = new Pool({
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

pool.on("error", (err) => {
  // Errores de conexiones ociosas en el pool (ej. la DB las cierra). No es
  // fatal: pg descarta esa conexión y crea una nueva en el próximo query.
  log.error("Error en el pool de PostgreSQL", { err });
});

export default pool;
