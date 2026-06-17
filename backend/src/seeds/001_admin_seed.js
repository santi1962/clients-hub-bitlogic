import bcrypt from "bcrypt";
import pool from "../db/pool.js";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_EMAIL = "admin@bitlogic.com.ar";
const ADMIN_PASSWORD = "Cambiar123!";
const ADMIN_NAME = "Admin Bitlogic";

export async function run() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const { rowCount } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'super_admin', 'active')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_ID, ADMIN_NAME, ADMIN_EMAIL, passwordHash],
  );

  if (rowCount > 0) {
    console.log(`  ✓ Usuario admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`  → Admin ya existe: ${ADMIN_EMAIL}`);
  }
}
