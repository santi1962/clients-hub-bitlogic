import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import config from "./config/index.js";

let _io = null;

export function initSocket(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    path: "/socket.io",
  });

  // Auth middleware — verifica el access token enviado en handshake.auth.token
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
