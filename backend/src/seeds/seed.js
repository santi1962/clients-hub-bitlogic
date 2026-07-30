/**
 * Seed runner — carga datos de DEMO (clientes, servicios, tickets, pagos
 * ficticios) para desarrollo/pruebas locales. NO es el bootstrap de
 * producción (ver `npm run db:create-admin` para crear el primer
 * super_admin real).
 *
 * Uso: npm run seed:demo -- --yes
 *
 * Guardas:
 *   - Se niega a correr si NODE_ENV=production, sin excepción.
 *   - Requiere confirmación explícita (--yes o CONFIRM_DEMO_SEED=true) para
 *     evitar cargarlo por accidente contra una base que no es de prueba.
 */
import "dotenv/config";
import pool from "../db/pool.js";
import { run as seedAdmin } from "./001_admin_seed.js";
import { run as seedCoreHosting } from "./002_core_hosting_seed.js";
import { run as seedBilling } from "./003_billing_seed.js";
import { run as seedDomains } from "./004_domains_seed.js";
import { run as seedSupport } from "./005_support_seed.js";
import { run as seedClientUsers } from "./006_client_users_seed.js";
import { run as seedTasks } from "./007_tasks_seed.js";

if (process.env.NODE_ENV === "production") {
  console.error("[seed:demo] FATAL: NODE_ENV=production — los seeds de demo nunca se ejecutan en producción.");
  process.exit(1);
}

const confirmed = process.argv.includes("--yes") || process.env.CONFIRM_DEMO_SEED === "true";
if (!confirmed) {
  console.error(
    "[seed:demo] Este comando carga datos de DEMO (clientes, tickets, pagos ficticios). " +
    "Confirmá explícitamente con `npm run seed:demo -- --yes` (o CONFIRM_DEMO_SEED=true) para continuar.",
  );
  process.exit(1);
}

console.log("Running demo seeds…");

await seedAdmin();
await seedCoreHosting();
await seedBilling();
await seedDomains();
await seedClientUsers();
await seedSupport();
await seedTasks();

await pool.end();
console.log("\nDemo seeds complete.");
