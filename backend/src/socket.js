import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import config from "./config/index.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("socket");

let _io = null;

export function initSocket(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    path: "/socket.io",
  });

  // Auth middleware — verifica el access token enviado en handshake.auth.token.
  // Nunca loguear el token en sí, solo el resultado de la verificación.
  _io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = jwt.verify(token, config.jwt.accessSecret);
      socket.user = payload;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  // Un error de conexión individual (auth inválida, transporte roto, etc.)
  // nunca debe tirar abajo el proceso — Socket.IO ya aísla esto por socket,
  // esto es solo para tener visibilidad en los logs.
  _io.engine.on("connection_error", (err) => {
    log.warn("Error de conexión de socket", { code: err.code, message: err.message });
  });

  _io.on("connection", (socket) => {
    // El cliente se une a la sala del ticket que está viendo
    socket.on("join:ticket", (ticketId) => {
      if (typeof ticketId === "string" && ticketId.length < 100) {
        socket.join(`ticket:${ticketId}`);
      }
    });

    socket.on("leave:ticket", (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });
  });

  return _io;
}

export function getIo() {
  return _io;
}

/** Cierra Socket.IO de forma ordenada (usado en el graceful shutdown). */
export function closeSocket() {
  return new Promise((resolve) => {
    if (!_io) return resolve();
    _io.close(() => resolve());
  });
}
