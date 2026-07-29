/**
 * Seed runner — ejecuta todos los seeds en orden.
 * Uso: npm run seed
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

console.log("Running seeds…");

await seedAdmin();
await seedCoreHosting();
await seedBilling();
await seedDomains();
await seedClientUsers();
await seedSupport();
await seedTasks();

await pool.end();
console.log("\nSeeds complete.");
