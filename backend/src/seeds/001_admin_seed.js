import bcrypt from "bcrypt";
import pool from "../db/pool.js";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_EMAIL = "admin@bitlogic.com.ar";
const ADMIN_PASSWORD = "Cambiar123!";
const ADMIN_NAME = "Admin Bitlogic";

const INSERT_SQL = `INSERT IGNORE INTO users (id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'super_admin', 'active')`;

export async function run() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const { rowCount } = await pool.query(INSERT_SQL, [ADMIN_ID, ADMIN_NAME, ADMIN_EMAIL, passwordHash]);

  if (rowCount > 0) {
    // No se expone la contraseña en logs — queda solo en este archivo
    // (constante ADMIN_PASSWORD), como corresponde a un valor que se debe
    // cambiar inmediatamente después del primer login.
    console.log(`  ✓ Usuario admin creado: ${ADMIN_EMAIL} (contraseña inicial definida en este archivo — cambiarla tras el primer login)`);
  } else {
    console.log(`  → Admin ya existe: ${ADMIN_EMAIL}`);
  }
}
