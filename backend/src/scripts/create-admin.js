#!/usr/bin/env node
/**
 * Bootstrap del primer super_admin de producción.
 *
 * Independiente de los seeds de demo (`npm run seed:demo`) — este es el
 * único camino soportado para crear un usuario administrador real. No tiene
 * ninguna credencial hardcodeada: todo sale de variables de entorno
 * explícitas, obligatorias.
 *
 * Uso:
 *   ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run db:create-admin
 *
 * Variables requeridas:
 *   ADMIN_NAME      Nombre completo del admin.
 *   ADMIN_EMAIL     Email (se normaliza a minúsculas).
 *   ADMIN_PASSWORD  Password en texto plano — nunca se loguea ni se imprime.
 *
 * Comportamiento:
 *   - Idempotente por email: si ya existe un usuario con ese email, no hace
 *     nada (no cambia rol/password) salvo que se pase --update-password.
 *   - Valida longitud mínima de password (12 caracteres) antes de hashear.
 *   - Hashea con bcrypt (mismos rounds que el resto de la app).
 *   - No imprime la password en ningún log.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import config from "../config/index.js";

const MIN_PASSWORD_LENGTH = 12;

function fail(msg) {
  console.error(`[db:create-admin] FATAL: ${msg}`);
  process.exit(1);
}

const name = process.env.ADMIN_NAME?.trim();
const emailRaw = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
const updatePassword = process.argv.includes("--update-password");

if (!name) fail("falta ADMIN_NAME.");
if (!emailRaw) fail("falta ADMIN_EMAIL.");
if (!password) fail("falta ADMIN_PASSWORD.");

const email = emailRaw.toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail(`ADMIN_EMAIL no parece un email válido: "${email}".`);
}

if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
}

async function createAdmin() {
  const { rows } = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  const existing = rows[0];

  if (existing && !updatePassword) {
    console.log(`[db:create-admin] Ya existe un usuario con email ${email} (id=${existing.id}) — no se modificó nada.`);
    console.log("[db:create-admin] Para actualizar su password, volvé a correr con --update-password.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);

  if (existing) {
    await pool.query(
      "UPDATE users SET password_hash = ?, role = 'super_admin', status = 'active' WHERE id = ?",
      [passwordHash, existing.id],
    );
    console.log(`[db:create-admin] Password actualizada para ${email} (id=${existing.id}).`);
    return;
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'super_admin', 'active')`,
    [id, name, email, passwordHash],
  );
  console.log(`[db:create-admin] super_admin creado: ${email} (id=${id}).`);
}

createAdmin()
  .catch((err) => {
    console.error("[db:create-admin] Error:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
