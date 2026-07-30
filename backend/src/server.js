import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { initSocket, closeSocket } from "./socket.js";
import config from "./config/index.js";
import pool from "./db/pool.js";
import { startWhatsApp } from "./services/whatsapp.service.js";
import { initScheduler, stopScheduler, waitForRunningJobs } from "./services/scheduler-init.service.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("server");

const SHUTDOWN_TIMEOUT_MS = 10_000;
// Parte del presupuesto de SHUTDOWN_TIMEOUT_MS reservada para esperar a que
// un job en curso termine, antes de cerrar el pool que ese job usa.
const JOB_SHUTDOWN_WAIT_MS = 8_000;

let httpServer = null;
let shuttingDown = false;

async function start() {
  try {
    await pool.query("SELECT 1");
    log.info("MariaDB conectado");
  } catch (err) {
    log.error("No se pudo conectar a MariaDB. Verificá DATABASE_URL (o DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) y que el servidor esté corriendo.", { err });
    process.exit(1);
  }

  httpServer = createServer(app);
  initSocket(httpServer);

  // El backend corre detrás de Nginx (ver DEPLOYMENT_GUIDE.md). Mantener el
  // keep-alive de Node por encima del típico timeout de upstream evita que
  // Nginx reutilice una conexión que Node ya cerró silenciosamente.
  // headersTimeout debe ser mayor a keepAliveTimeout (Node lo exige).
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;

  httpServer.listen(config.port, () => {
    log.info("Bitlogic Backend iniciado", {
      port: config.port,
      environment: config.nodeEnv,
      corsOrigin: config.cors.origin,
      websockets: true,
    });
  });

  if (config.whatsapp.enabled) {
    startWhatsApp().catch((err) => log.error("Error al iniciar WhatsApp", { err }));
  }

  // Se registra después de confirmar que Postgres responde (arriba) y de
  // levantar el servidor HTTP — no dispara ninguna ejecución al arrancar,
  // solo programa los próximos ticks de cron (o queda en modo solo-manual
  // si SCHEDULER_ENABLED=false).
  initScheduler();
}

/**
 * Apagado ordenado: deja de aceptar conexiones nuevas, cierra Socket.IO y el
 * pool de PostgreSQL, y solo entonces termina el proceso. Si algo se cuelga
 * (ej. una conexión keep-alive que Nginx nunca cierra), un timeout fuerza la
 * salida para que PM2 no quede con un proceso zombie.
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`Señal ${signal} recibida, iniciando apagado ordenado`);

  const forceExitTimer = setTimeout(() => {
    log.error(`Apagado ordenado no terminó en ${SHUTDOWN_TIMEOUT_MS}ms, forzando salida`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    // Primero: que no arranque ninguna ejecución nueva de cron.
    stopScheduler();
    log.info("Scheduler detenido (no se programan más ejecuciones)");

    if (httpServer?.listening) {
      httpServer.closeIdleConnections?.();
      await new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      log.info("Servidor HTTP cerrado");
    }

    // Si un job (manual o programado) está a mitad de ejecución, darle
    // tiempo acotado a terminar antes de cerrar el pool que usa.
    const { settled, stillRunning } = await waitForRunningJobs(JOB_SHUTDOWN_WAIT_MS);
    if (settled) {
      log.info("Ningún job en ejecución al momento del apagado");
    } else {
      log.error(`Job(s) sin terminar tras ${JOB_SHUTDOWN_WAIT_MS}ms de espera, se continúa igual`, {
        stillRunning,
      });
    }

    await closeSocket();
    log.info("Socket.IO cerrado");

    await pool.end();
    log.info(`Pool de ${driverLabel} cerrado`);

    clearTimeout(forceExitTimer);
    log.info("Apagado ordenado completo");
    process.exit(0);
  } catch (err) {
    log.error("Error durante el apagado ordenado", { err });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Una promesa rechazada sin .catch() no debe pasar desapercibida, pero
// tampoco es necesariamente fatal — se loguea para investigar.
process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  log.error("unhandledRejection no manejado", { err });
});

// Un uncaughtException deja el proceso en estado potencialmente inconsistente
// (Node mismo lo recomienda): se loguea y se intenta un apagado ordenado en
// vez de seguir sirviendo tráfico con estado corrupto.
process.on("uncaughtException", (err) => {
  log.error("uncaughtException — iniciando apagado", { err });
  shutdown("uncaughtException");
});

start().catch((err) => {
  log.error("Error al iniciar el servidor", { err });
  process.exit(1);
});
