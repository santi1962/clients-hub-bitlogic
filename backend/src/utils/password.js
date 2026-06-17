import bcrypt from "bcrypt";
import config from "../config/index.js";

export async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcrypt.rounds);
}

export async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}
