/**
 * Client Users Seed (Phase 3B)
 * Creates client users for real portal testing
 */
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import config from "../config/index.js";

const PASSWORD = "Cambiar123!";

// ON CONFLICT (email) DO NOTHING (Postgres) vs INSERT IGNORE (MariaDB) —
// mismo criterio de branching que seeds/001_admin_seed.js.
const INSERT_CLIENT_USER_SQL =
  config.db.driver === "mysql"
    ? `INSERT IGNORE INTO users (id, name, email, password_hash, role, status, client_id)
       VALUES (?, ?, ?, ?, 'cliente', 'active', ?)`
    : `INSERT INTO users (id, name, email, password_hash, role, status, client_id)
       VALUES (?, ?, ?, ?, 'cliente', 'active', ?)
       ON CONFLICT (email) DO NOTHING`;

const CLIENTS = [
  {
    email: "cliente1@bitlogic.test",
    name: "Cliente 1",
    clientId: "22222222-2222-2222-2222-000000000001",
  },
  {
    email: "cliente2@bitlogic.test",
    name: "Cliente 2",
    clientId: "22222222-2222-2222-2222-000000000002",
  },
  {
    email: "cliente3@bitlogic.test",
    name: "Cliente 3",
    clientId: "22222222-2222-2222-2222-000000000003",
  },
  {
    email: "cliente4@bitlogic.test",
    name: "Cliente 4",
    clientId: "22222222-2222-2222-2222-000000000004",
  },
];

export async function run() {
  const client = await pool.connect();
  try {
    console.log("  Seeding client users…");
    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const u of CLIENTS) {
      const { rowCount } = await client.query(INSERT_CLIENT_USER_SQL, [
        randomUUID(),
        u.name,
        u.email,
        passwordHash,
        u.clientId,
      ]);

      if (rowCount > 0) {
        console.log(`  ✓ ${u.email} / ${PASSWORD}`);
      } else {
        console.log(`  → ${u.email} ya existe`);
      }
    }

    console.log(`  ✓ Client Users: ${CLIENTS.length} usuarios`);
  } finally {
    client.release();
  }
}
