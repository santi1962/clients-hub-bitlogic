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

pool.on("connect", (client) => {
  client.query("SET client_encoding = 'UTF8'").catch((err) => {
    log.error("Error configurando encoding UTF-8 en conexión nueva", { err });
  });
});

pool.on("error", (err) => {
  // Errores de conexiones ociosas en el pool (ej. la DB las cierra). No es
  // fatal: pg descarta esa conexión y crea una nueva en el próximo query.
  log.error("Error en el pool de PostgreSQL", { err });
});

export default pool;
