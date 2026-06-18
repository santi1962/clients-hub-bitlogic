import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pool from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  "001_auth_schema.sql",
  "002_core_hosting_schema.sql",
  "003_billing_schema.sql",
  "004_domains_schema.sql",
  "005_support_schema.sql",
  "006_tasks_schema.sql",
  "007_email_logs_schema.sql",
  "008_audit_logs_schema.sql",
  "009_scheduler_logs_schema.sql",
  "010_automation_settings_schema.sql",
  "011_payment_reminder_logs_schema.sql",
  "012_settings_schema.sql",
];

console.log("Running migrations…");

for (const file of migrations) {
  const sql = readFileSync(join(__dirname, "../migrations", file), "utf8");
  await pool.query(sql);
  console.log(`  ✓ ${file}`);
}

await pool.end();
console.log("Migrations complete.");
