/**
 * Reset destructivo de la base de datos (DROP + CREATE). Uso exclusivo de
 * desarrollo/test local. Requiere:
 *   - NODE_ENV distinto de "production" (se niega incondicionalmente si es
 *     "production", sin ninguna forma de override).
 *   - Confirmación explícita: `npm run db:reset -- --yes` (o
 *     CONFIRM_DB_RESET=true).
 *   - DATABASE_URL (o DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) ya
 *     configuradas — no hay ningún usuario/password hardcodeado de fallback.
 *
 * Uso: npm run db:reset -- --yes
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import config from "../config/index.js";

if (process.env.NODE_ENV === "production") {
  console.error("[db:reset] FATAL: NODE_ENV=production — un reset destructivo nunca corre en producción.");
  process.exit(1);
}

const confirmed = process.argv.includes("--yes") || process.env.CONFIRM_DB_RESET === "true";
if (!confirmed) {
  console.error(
    "[db:reset] Esto borra y vuelve a crear la base de datos configurada. " +
    "Confirmá explícitamente con `npm run db:reset -- --yes` (o CONFIRM_DB_RESET=true) para continuar.",
  );
  process.exit(1);
}

if (!config.db.connectionString) {
  console.error("[db:reset] FATAL: no hay DATABASE_URL ni DB_HOST/DB_NAME/DB_USER configurados.");
  process.exit(1);
}

async function reset() {
  const target = new URL(config.db.connectionString);
  const dbName = target.pathname.replace(/^\//, "");
  if (!dbName) {
    console.error("[db:reset] FATAL: la connection string no especifica un nombre de base de datos.");
    process.exit(1);
  }

  // Conecta sin `database` para poder DROP/CREATE la base indicada.
  const admin = await mysql.createConnection({
    host: target.hostname,
    port: target.port || 3306,
    user: decodeURIComponent(target.username || "root"),
    password: decodeURIComponent(target.password || ""),
  });

  try {
    console.log(`Dropping database ${dbName}…`);
    await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`Creating database ${dbName}…`);
    await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci`);
    console.log("Database reset complete.");
  } finally {
    await admin.end();
  }
}

reset().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
