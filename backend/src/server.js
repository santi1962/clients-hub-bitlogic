import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { initSocket } from "./socket.js";
import config from "./config/index.js";
import pool from "./db/pool.js";
import { startWhatsApp } from "./services/whatsapp.service.js";

async function start() {
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

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`\n  Bitlogic Backend`);
    console.log(`  ✓ Corriendo en http://localhost:${config.port}`);
    console.log(`  ✓ WebSockets activos`);
    console.log(`  ✓ Entorno: ${config.nodeEnv}`);
    console.log(`  ✓ CORS origen: ${config.cors.origin}\n`);
  });

  if (config.whatsapp.enabled) {
    startWhatsApp().catch((err) => console.error("[WhatsApp] Error al iniciar:", err.message));
  }
}

start().catch((err) => {
  console.error("Error al iniciar el servidor:", err);
  process.exit(1);
});

