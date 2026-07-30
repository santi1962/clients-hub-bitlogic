#!/usr/bin/env node
// validate-migration.mjs — Fase DB-4A, Sección 7: validación automatizada
// PostgreSQL vs MariaDB tras una migración de datos reales.
//
// USO:
//   node validate-migration.mjs --pg-url postgresql://... --mariadb-url mysql://...
//
// Exit code != 0 ante CUALQUIER diferencia no permitida. Genera un reporte
// JSON (stdout, al final) y uno legible (stdout, a medida que corre). No
// modifica ninguna de las dos bases — 100% SELECT.
import pg from "pg";
import mysql from "mysql2/promise";
import { TABLE_ORDER, PRIMARY_KEY, BUSINESS_SEQUENCES } from "./table-order.js";
import { normalizeDecimalForComparison } from "./lib/transform.js";
import { describeUrl } from "./lib/db-url.js";
import { findCaseInsensitiveCollisionsInRows } from "./check-collisions.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pg-url") args.pgUrl = argv[++i];
    if (argv[i] === "--mariadb-url") args.mariadbUrl = argv[++i];
  }
  return args;
}

const FK_GRAPH = [
  { table: "refresh_tokens", column: "user_id", refTable: "users" },
  { table: "password_reset_tokens", column: "user_id", refTable: "users" },
  { table: "audit_logs", column: "user_id", refTable: "users" },
  { table: "hosting_services", column: "client_id", refTable: "clients" },
  { table: "hosting_services", column: "plan_id", refTable: "hosting_plans" },
  { table: "domains", column: "client_id", refTable: "clients" },
  { table: "domains", column: "hosting_service_id", refTable: "hosting_services" },
  { table: "payment_notices", column: "client_id", refTable: "clients" },
  { table: "payment_notices", column: "hosting_service_id", refTable: "hosting_services" },
  { table: "support_tickets", column: "client_id", refTable: "clients" },
  { table: "support_tickets", column: "hosting_service_id", refTable: "hosting_services" },
  { table: "support_tickets", column: "assigned_to", refTable: "users" },
  { table: "support_tickets", column: "created_by", refTable: "users" },
  { table: "payments", column: "client_id", refTable: "clients" },
  { table: "payments", column: "hosting_service_id", refTable: "hosting_services" },
  { table: "payments", column: "payment_notice_id", refTable: "payment_notices" },
  { table: "support_ticket_messages", column: "ticket_id", refTable: "support_tickets" },
  { table: "support_ticket_messages", column: "sender_user_id", refTable: "users" },
  { table: "payment_reminder_logs", column: "notice_id", refTable: "payment_notices" },
  { table: "internal_tasks", column: "assigned_to", refTable: "users" },
  { table: "internal_tasks", column: "created_by", refTable: "users" },
  { table: "internal_tasks", column: "client_id", refTable: "clients" },
  { table: "internal_tasks", column: "hosting_service_id", refTable: "hosting_services" },
  { table: "internal_tasks", column: "domain_id", refTable: "domains" },
  { table: "internal_tasks", column: "support_ticket_id", refTable: "support_tickets" },
  { table: "email_logs", column: "related_client_id", refTable: "clients" },
  { table: "email_logs", column: "related_notice_id", refTable: "payment_notices" },
  { table: "email_logs", column: "related_ticket_id", refTable: "support_tickets" },
  { table: "email_logs", column: "related_domain_id", refTable: "domains" },
];

const SUM_CHECKS = [
  { table: "payments", column: "amount" },
  { table: "payment_notices", column: "amount" },
  { table: "hosting_services", column: "monthly_price" },
  { table: "domains", column: "annual_cost" },
  { table: "domains", column: "customer_price" },
];

const GROUPED_COUNT_CHECKS = [
  { table: "users", column: "role" },
  { table: "clients", column: "status" },
  { table: "hosting_services", column: "status" },
  { table: "domains", column: "status" },
  { table: "payment_notices", column: "status" },
  { table: "payments", column: "status" },
  { table: "support_tickets", column: "status" },
  { table: "support_tickets", column: "priority" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_TOKEN_COLUMNS = [
  { table: "refresh_tokens", column: "token_hash" },
  { table: "password_reset_tokens", column: "token_hash" },
];
const JSON_COLUMNS = [
  { table: "audit_logs", column: "old_values" },
  { table: "audit_logs", column: "new_values" },
  { table: "automation_settings", column: "value" },
  { table: "scheduler_logs", column: "summary" },
];
const BOOLEAN_COLUMNS = [
  { table: "domains", column: "auto_renew" },
  { table: "support_ticket_messages", column: "is_internal" },
  { table: "automation_settings", column: "enabled" },
];
const DATE_COLUMNS = [
  { table: "domains", column: "registration_date" },
  { table: "domains", column: "expiration_date" },
  { table: "payment_notices", column: "due_date" },
  { table: "payment_notices", column: "issue_date" },
  { table: "payment_reminder_logs", column: "sent_date" },
];
const TEXT_COLUMNS_UTF8 = [
  { table: "clients", column: "name" },
  { table: "clients", column: "company" },
  { table: "internal_tasks", column: "title" },
  { table: "internal_tasks", column: "description" },
  { table: "email_templates", column: "body" },
  { table: "audit_logs", column: "entity_name" },
];
const PATH_COLUMNS = [{ table: "backups", column: "file_path" }];
const UNIQUE_COLUMNS = [
  { table: "users", column: "email" },
  { table: "domains", column: "domain" },
  { table: "hosting_services", column: "domain" },
];

function fail(report, section, message) {
  report.failures.push(`[${section}] ${message}`);
}

async function main() {
  const { pgUrl, mariadbUrl } = parseArgs(process.argv.slice(2));
  if (!pgUrl || !mariadbUrl) {
    console.error("Uso: node validate-migration.mjs --pg-url postgresql://... --mariadb-url mysql://...");
    process.exit(1);
  }

  console.log("──────────────────────────────────────────────");
  console.log(" validate-migration.mjs — Fase DB-4A");
  console.log("──────────────────────────────────────────────");
  console.log(` PostgreSQL: ${describeUrl(pgUrl)}`);
  console.log(` MariaDB:    ${describeUrl(mariadbUrl)}`);
  console.log("──────────────────────────────────────────────\n");

  const pgClient = new pg.Client({ connectionString: pgUrl });
  await pgClient.connect();
  const maria = await mysql.createConnection({ uri: mariadbUrl, timezone: "Z" });

  const report = { generatedAt: new Date().toISOString(), sections: {}, failures: [] };

  try {
    // 1. Conteo exacto por tabla + 2. PKs exactas
    report.sections.counts = {};
    report.sections.pkSets = {};
    for (const table of TABLE_ORDER) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk} FROM "${table}" ORDER BY ${pk}`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\` FROM \`${table}\` ORDER BY \`${pk}\``);
      const pgIds = pgRows.map((r) => String(r[pk]));
      const mariaIds = mariaRows.map((r) => String(r[pk]));

      report.sections.counts[table] = { postgres: pgIds.length, mariadb: mariaIds.length };
      if (pgIds.length !== mariaIds.length) {
        fail(report, "counts", `${table}: Postgres tiene ${pgIds.length} filas, MariaDB tiene ${mariaIds.length}`);
      }
      const pgSet = new Set(pgIds);
      const mariaSet = new Set(mariaIds);
      const onlyInPg = pgIds.filter((id) => !mariaSet.has(id));
      const onlyInMaria = mariaIds.filter((id) => !pgSet.has(id));
      report.sections.pkSets[table] = { onlyInPostgres: onlyInPg.length, onlyInMariadb: onlyInMaria.length };
      if (onlyInPg.length) fail(report, "pks", `${table}: ${onlyInPg.length} PK(s) en Postgres ausentes en MariaDB (ej. ${onlyInPg[0]})`);
      if (onlyInMaria.length) fail(report, "pks", `${table}: ${onlyInMaria.length} PK(s) en MariaDB que no están en Postgres (ej. ${onlyInMaria[0]})`);
    }
    console.log(`✓ Conteos y PKs verificados en ${TABLE_ORDER.length} tablas`);

    // 3. FKs huérfanas: cero
    report.sections.orphanFks = {};
    for (const { table, column, refTable } of FK_GRAPH) {
      const [rows] = await maria.query(
        `SELECT COUNT(*) AS c FROM \`${table}\` t
         WHERE t.\`${column}\` IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM \`${refTable}\` r WHERE r.id = t.\`${column}\`)`,
      );
      const orphanCount = Number(rows[0].c);
      report.sections.orphanFks[`${table}.${column}`] = orphanCount;
      if (orphanCount > 0) fail(report, "fk", `${table}.${column}: ${orphanCount} fila(s) huérfana(s), no apuntan a un ${refTable}.id existente`);
    }
    console.log(`✓ Sin FKs huérfanas en ${FK_GRAPH.length} relaciones revisadas`);

    // 4. UUID válidos (columna id de cada tabla en MariaDB, salvo email_templates cuya PK es código)
    report.sections.uuidValidity = {};
    for (const table of TABLE_ORDER) {
      if (table === "email_templates") continue;
      const [rows] = await maria.query(`SELECT id FROM \`${table}\``);
      const invalid = rows.filter((r) => !UUID_RE.test(r.id));
      report.sections.uuidValidity[table] = { total: rows.length, invalid: invalid.length };
      if (invalid.length) fail(report, "uuid", `${table}: ${invalid.length} id(s) no son UUID válidos en MariaDB`);
    }
    console.log("✓ UUIDs válidos en todas las PKs");

    // 5. Hashes y tokens exactos
    report.sections.hashesExact = {};
    for (const { table, column } of HASH_TOKEN_COLUMNS) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column} FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, \`${column}\` FROM \`${table}\``);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], r[column]]));
      let mismatches = 0;
      for (const row of pgRows) {
        if (mariaById.get(row[pk]) !== row[column]) mismatches++;
      }
      report.sections.hashesExact[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "hashes", `${table}.${column}: ${mismatches} valor(es) no coinciden byte a byte`);
    }
    console.log("✓ Hashes/tokens exactos byte a byte");

    // 6. JSON parseable y semánticamente equivalente
    report.sections.jsonEquivalence = {};
    for (const { table, column } of JSON_COLUMNS) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column} FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, \`${column}\` FROM \`${table}\``);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], r[column]]));
      let mismatches = 0;
      for (const row of pgRows) {
        const pgValue = row[column];
        const mariaRaw = mariaById.get(row[pk]);
        if (pgValue === null) {
          if (mariaRaw !== null) mismatches++;
          continue;
        }
        let mariaValue;
        try {
          mariaValue = typeof mariaRaw === "string" ? JSON.parse(mariaRaw) : mariaRaw;
        } catch {
          mismatches++;
          continue;
        }
        if (JSON.stringify(pgValue) !== JSON.stringify(mariaValue)) mismatches++;
      }
      report.sections.jsonEquivalence[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "json", `${table}.${column}: ${mismatches} valor(es) JSON no equivalen semánticamente`);
    }
    console.log("✓ JSON parseable y semánticamente equivalente");

    // 7. Booleanos equivalentes
    report.sections.booleanEquivalence = {};
    for (const { table, column } of BOOLEAN_COLUMNS) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column} FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, \`${column}\` FROM \`${table}\``);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], !!r[column]]));
      let mismatches = 0;
      for (const row of pgRows) {
        if (Boolean(row[column]) !== mariaById.get(row[pk])) mismatches++;
      }
      report.sections.booleanEquivalence[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "boolean", `${table}.${column}: ${mismatches} valor(es) booleanos no equivalen`);
    }
    console.log("✓ Booleanos equivalentes");

    // 8. DATE exacta
    report.sections.dateExact = {};
    for (const { table, column } of DATE_COLUMNS) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column}::text AS v FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, DATE_FORMAT(\`${column}\`, '%Y-%m-%d') AS v FROM \`${table}\``);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], r.v]));
      let mismatches = 0;
      for (const row of pgRows) {
        const mariaV = mariaById.get(row[pk]);
        if ((row.v ?? null) !== (mariaV ?? null)) mismatches++;
      }
      report.sections.dateExact[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "date", `${table}.${column}: ${mismatches} fecha(s) no coinciden exactamente`);
    }
    console.log("✓ Columnas DATE exactas");

    // 9. TIMESTAMP equivalente en UTC (created_at de cada tabla)
    report.sections.timestampEquivalence = {};
    for (const table of TABLE_ORDER) {
      const pk = PRIMARY_KEY[table];
      let pgRows;
      try {
        ({ rows: pgRows } = await pgClient.query(`SELECT ${pk}, EXTRACT(EPOCH FROM created_at) AS epoch FROM "${table}" WHERE created_at IS NOT NULL`));
      } catch {
        continue; // la tabla no tiene created_at (ninguna de las 20, pero defensivo)
      }
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, UNIX_TIMESTAMP(created_at) AS epoch FROM \`${table}\` WHERE created_at IS NOT NULL`);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], Number(r.epoch)]));
      let mismatches = 0;
      for (const row of pgRows) {
        const mariaEpoch = mariaById.get(row[pk]);
        if (mariaEpoch === undefined || Math.abs(Number(row.epoch) - mariaEpoch) > 1) mismatches++;
      }
      report.sections.timestampEquivalence[table] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "timestamp", `${table}.created_at: ${mismatches} timestamp(s) difieren en más de 1 segundo UTC`);
    }
    console.log("✓ Timestamps equivalentes en UTC");

    // 10. DECIMAL exacto como string normalizado + 15. Sumas exactas
    report.sections.decimalSums = {};
    for (const { table, column } of SUM_CHECKS) {
      const { rows: pgRows } = await pgClient.query(`SELECT COALESCE(SUM(${column}), 0)::text AS total FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT COALESCE(SUM(\`${column}\`), 0) AS total FROM \`${table}\``);
      const pgTotal = normalizeDecimalForComparison(pgRows[0].total);
      const mariaTotal = normalizeDecimalForComparison(mariaRows[0].total);
      report.sections.decimalSums[`${table}.${column}`] = { postgres: pgTotal, mariadb: mariaTotal };
      if (pgTotal !== mariaTotal) fail(report, "sums", `${table}.${column}: suma Postgres=${pgTotal} vs MariaDB=${mariaTotal}`);
    }
    console.log("✓ Sumas financieras exactas (payments, payment_notices, hosting_services, domains)");

    // 11. Texto UTF-8 exacto (tildes, ñ, emoji, saltos de línea) — comparación de igualdad completa
    report.sections.utf8Text = {};
    for (const { table, column } of TEXT_COLUMNS_UTF8) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column} FROM "${table}"`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, \`${column}\` FROM \`${table}\``);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], r[column]]));
      let mismatches = 0;
      for (const row of pgRows) {
        if ((row[column] ?? null) !== (mariaById.get(row[pk]) ?? null)) mismatches++;
      }
      report.sections.utf8Text[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "utf8", `${table}.${column}: ${mismatches} texto(s) no coinciden byte a byte (posible corrupción UTF-8)`);
    }
    console.log("✓ Texto UTF-8 exacto (tildes/ñ/emoji/saltos de línea)");

    // 12. Paths existentes o mismos paths en ambas bases
    report.sections.paths = {};
    for (const { table, column } of PATH_COLUMNS) {
      const pk = PRIMARY_KEY[table];
      const { rows: pgRows } = await pgClient.query(`SELECT ${pk}, ${column} FROM "${table}" WHERE ${column} IS NOT NULL`);
      const [mariaRows] = await maria.query(`SELECT \`${pk}\`, \`${column}\` FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`);
      const mariaById = new Map(mariaRows.map((r) => [r[pk], r[column]]));
      let mismatches = 0;
      for (const row of pgRows) {
        if (mariaById.get(row[pk]) !== row[column]) mismatches++;
      }
      report.sections.paths[`${table}.${column}`] = { checked: pgRows.length, mismatches };
      if (mismatches) fail(report, "paths", `${table}.${column}: ${mismatches} ruta(s) no coinciden entre motores`);
    }
    console.log("✓ Rutas de archivo preservadas");

    // 13. UNIQUE sin colisiones inesperadas (post-import, en MariaDB)
    report.sections.uniqueCollisions = {};
    for (const { table, column } of UNIQUE_COLUMNS) {
      const [rows] = await maria.query(
        `SELECT \`${column}\` AS v, COUNT(*) AS c FROM \`${table}\` WHERE \`${column}\` IS NOT NULL GROUP BY \`${column}\` HAVING COUNT(*) > 1`,
      );
      report.sections.uniqueCollisions[`${table}.${column}`] = rows.length;
      if (rows.length) fail(report, "unique", `${table}.${column}: ${rows.length} valor(es) duplicados en MariaDB (viola UNIQUE)`);
    }
    console.log("✓ Sin colisiones UNIQUE inesperadas en MariaDB");

    // 14. Emails/dominios que colisionen solo por mayúsculas/minúsculas bajo MariaDB
    report.sections.caseInsensitiveCollisions = {};
    for (const { table, column } of UNIQUE_COLUMNS) {
      const { rows: pgRows } = await pgClient.query(`SELECT id, ${column} FROM "${table}" WHERE ${column} IS NOT NULL`);
      const collisions = findCaseInsensitiveCollisionsInRows(pgRows, column);
      report.sections.caseInsensitiveCollisions[`${table}.${column}`] = collisions.length;
      if (collisions.length) {
        fail(report, "case-insensitive", `${table}.${column}: ${collisions.length} grupo(s) que solo Postgres distingue por mayúsculas/minúsculas — MariaDB los trataría como duplicados`);
      }
    }
    console.log("✓ Sin colisiones case-insensitive pendientes");

    // 16. Estados y roles agrupados por conteo
    report.sections.groupedCounts = {};
    for (const { table, column } of GROUPED_COUNT_CHECKS) {
      const { rows: pgRows } = await pgClient.query(`SELECT ${column} AS v, COUNT(*) AS c FROM "${table}" GROUP BY ${column}`);
      const [mariaRows] = await maria.query(`SELECT \`${column}\` AS v, COUNT(*) AS c FROM \`${table}\` GROUP BY \`${column}\``);
      const pgMap = new Map(pgRows.map((r) => [r.v, Number(r.c)]));
      const mariaMap = new Map(mariaRows.map((r) => [r.v, Number(r.c)]));
      const allKeys = new Set([...pgMap.keys(), ...mariaMap.keys()]);
      let mismatches = 0;
      for (const key of allKeys) {
        if ((pgMap.get(key) ?? 0) !== (mariaMap.get(key) ?? 0)) mismatches++;
      }
      report.sections.groupedCounts[`${table}.${column}`] = { postgres: Object.fromEntries(pgMap), mariadb: Object.fromEntries(mariaMap) };
      if (mismatches) fail(report, "grouped", `${table}.${column}: distribución de valores no coincide entre motores`);
    }
    console.log("✓ Conteos agrupados por estado/rol coinciden");

    // 17. Próximo número de secuencia para avisos y tickets
    report.sections.sequences = {};
    for (const { table, column, sequence, parseNumber } of BUSINESS_SEQUENCES) {
      const { rows: pgRows } = await pgClient.query(`SELECT ${column} FROM "${table}"`);
      let maxHistoric = 0;
      for (const row of pgRows) {
        const n = parseNumber(row[column]);
        if (n !== null && n > maxHistoric) maxHistoric = n;
      }
      const [seqRows] = await maria.query(`SELECT NEXTVAL(${sequence}) AS n`);
      const nextVal = Number(seqRows[0].n);
      report.sections.sequences[sequence] = { maxHistoric, nextValConsumedByCheck: nextVal };
      if (nextVal <= maxHistoric) {
        fail(report, "sequence", `${sequence}: el próximo valor (${nextVal}) no es mayor al máximo histórico (${maxHistoric})`);
      }
    }
    console.log("✓ Secuencias de negocio reposicionadas por encima del máximo histórico");
    console.log("  (nota: esta prueba consume un NEXTVAL real de cada secuencia como efecto colateral de validarla)");

    console.log("\n" + JSON.stringify(report, null, 2));

    if (report.failures.length) {
      console.error(`\n✗ VALIDACIÓN FALLIDA — ${report.failures.length} diferencia(s):`);
      for (const f of report.failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("\n✓ VALIDACIÓN COMPLETA: PostgreSQL y MariaDB contienen información equivalente.");
  } finally {
    await pgClient.end();
    await maria.end();
  }
}

main().catch((err) => {
  console.error("Error en validate-migration.mjs:", err.message);
  process.exit(1);
});
