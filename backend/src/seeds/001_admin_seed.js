import bcrypt from "bcrypt";
import pool from "../db/pool.js";
import config from "../config/index.js";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_EMAIL = "admin@bitlogic.com.ar";
const ADMIN_PASSWORD = "Cambiar123!";
const ADMIN_NAME = "Admin Bitlogic";

// ON CONFLICT (Postgres) y INSERT IGNORE (MariaDB) no tienen una sintaxis
// común: es el único punto de esta fase donde la query varía según el
// driver, en vez de una sola query con placeholders `?` para ambos motores.
const INSERT_SQL =
  config.db.driver === "mysql"
    ? `INSERT IGNORE INTO users (id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'super_admin', 'active')`
    : `INSERT INTO users (id, name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'super_admin', 'active')
       ON CONFLICT (email) DO NOTHING`;

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
