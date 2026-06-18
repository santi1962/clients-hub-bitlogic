import pg from "pg";
import config from "../config/index.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.db.connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: "bitlogic-backend",
});

pool.on("connect", (client) => {
  client.query("SET client_encoding = 'UTF8'").catch((err) => {
    console.error("Error setting UTF-8 encoding:", err.message);
  });
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export default pool;
