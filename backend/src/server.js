import "dotenv/config";
import app from "./app.js";
import config from "./config/index.js";
import pool from "./db/pool.js";

async function start() {
  // Verificar conexión a PostgreSQL antes de aceptar tráfico
  try {
    await pool.query("SELECT 1");
    console.log("  ✓ PostgreSQL conectado");
  } catch (err) {
    console.error("  ✗ No se pudo conectar a PostgreSQL:", err.message);
    console.error(
      "    Verificá que DATABASE_URL esté configurado y que el servidor esté corriendo.",
    );
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`\n  Bitlogic Backend`);
    console.log(`  ✓ Corriendo en http://localhost:${config.port}`);
    console.log(`  ✓ Entorno: ${config.nodeEnv}`);
    console.log(`  ✓ CORS origen: ${config.cors.origin}\n`);
  });
}

start().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
  process.exit(1);
});
