#!/usr/bin/env node
/**
 * SCRIPT: Limpiar datos de demo/seed de producción
 * ─────────────────────────────────────────────────────────────────
 * Elimina SOLO los 6 clientes de demostración creados por los seeds:
 *   - Café del Valle
 *   - Estudio Acosta
 *   - MundoFit
 *   - Logisur SRL
 *   - Belladermo
 *   - Luna Arquitectos
 *
 * Y todos los registros relacionados (servicios, pagos, avisos, etc.)
 *
 * NO elimina:
 *   - Admin user (11111111-1111-1111-1111-111111111111)
 *   - Client users (clientes1@bitlogic.test, etc.)
 *   - Planes de hosting
 *   - Configuración de Hestia
 *   - Migraciones
 *
 * USO:
 *   npm run clear-demo-data
 * ─────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import pool from "../db/pool.js";
import * as readline from "readline";

if (process.env.NODE_ENV === "production") {
  console.error("[clear-demo-data] FATAL: NODE_ENV=production — este script asume datos de demo, nunca corre en producción.");
  process.exit(1);
}

const DEMO_CLIENT_IDS = [
  "22222222-2222-2222-2222-000000000001", // Café del Valle
  "22222222-2222-2222-2222-000000000002", // Estudio Acosta
  "22222222-2222-2222-2222-000000000003", // MundoFit
  "22222222-2222-2222-2222-000000000004", // Logisur SRL
  "22222222-2222-2222-2222-000000000005", // Belladermo
  "22222222-2222-2222-2222-000000000006", // Luna Arquitectos
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

async function clearDemoData() {
  console.log("\n" + "=".repeat(70));
  console.log("🗑️  LIMPIAR DATOS DE DEMO/SEED");
  console.log("=".repeat(70) + "\n");

  console.log("⚠️  ADVERTENCIA:");
  console.log("   Se eliminarán los siguientes clientes y TODOS sus datos asociados:");
  console.log("   - Café del Valle");
  console.log("   - Estudio Acosta");
  console.log("   - MundoFit");
  console.log("   - Logisur SRL");
  console.log("   - Belladermo");
  console.log("   - Luna Arquitectos\n");

  const confirm = await prompt("¿Continuar? (s/n) ");
  if (confirm !== "s" && confirm !== "si" && confirm !== "yes") {
    console.log("❌ Operación cancelada.\n");
    rl.close();
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("\n🔄 Eliminando registros...\n");

    // IN (?,?,...) en vez de ANY($1) — MariaDB no soporta ANY() con un
    // array como parámetro; se arma un placeholder por id.
    const placeholders = DEMO_CLIENT_IDS.map(() => "?").join(",");

    // 1. Mensajes de soporte (dependen de support_tickets)
    let res = await client.query(
      `DELETE FROM support_ticket_messages
       WHERE ticket_id IN (
         SELECT id FROM support_tickets WHERE client_id IN (${placeholders})
       )`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} mensajes de soporte`);

    // 2. Tickets de soporte
    res = await client.query(
      `DELETE FROM support_tickets WHERE client_id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} tickets de soporte`);

    // 3. Avisos de pago
    res = await client.query(
      `DELETE FROM payment_notices WHERE client_id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} avisos de pago`);

    // 4. Pagos
    res = await client.query(
      `DELETE FROM payments WHERE client_id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} pagos`);

    // 5. Dominios
    res = await client.query(
      `DELETE FROM domains WHERE client_id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} dominios`);

    // 6. Servicios de hosting (ON DELETE CASCADE, pero lo hacemos explícito)
    res = await client.query(
      `DELETE FROM hosting_services WHERE client_id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} servicios de hosting`);

    // 7. Clientes (elimina en cascada todo lo relacionado)
    res = await client.query(
      `DELETE FROM clients WHERE id IN (${placeholders})`,
      DEMO_CLIENT_IDS,
    );
    if (res.rowCount > 0) console.log(`  ✓ ${res.rowCount} clientes`);

    await client.query("COMMIT");

    console.log("\n✅ Limpieza completada exitosamente.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Error durante la limpieza:", err.message);
    process.exit(1);
  } finally {
    client.release();
    rl.close();
  }
}

await clearDemoData();
