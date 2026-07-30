/**
 * Orden de dependencia FK de las 20 tablas del schema (Fase DB-4A).
 *
 * Construido leyendo cada REFERENCES/FOREIGN KEY real de
 * backend/src/migrations/*.sql (la fuente de verdad de Postgres), no
 * asumido desde schema.sql. Un INSERT en orden `TABLE_ORDER` nunca puede
 * violar una FK (todo lo que una tabla referencia ya se insertó antes).
 * `TABLE_ORDER.slice().reverse()` es el orden seguro para DELETE/TRUNCATE
 * (no usado por el migrador, pero documentado por si hace falta un rollback
 * manual).
 *
 * Grafo de FKs (tabla -> tablas que referencia):
 *   refresh_tokens          -> users
 *   password_reset_tokens   -> users
 *   audit_logs              -> users
 *   hosting_services        -> clients, hosting_plans
 *   domains                 -> clients, hosting_services
 *   payment_notices         -> clients, hosting_services
 *   support_tickets         -> clients, hosting_services, users
 *   payments                -> clients, hosting_services, payment_notices
 *   support_ticket_messages -> support_tickets, users
 *   payment_reminder_logs   -> payment_notices
 *   internal_tasks          -> users, clients, hosting_services, domains, support_tickets
 *   email_logs              -> clients, payment_notices, support_tickets, domains
 *
 * Sin FKs (pueden ir en cualquier momento antes de sus dependientes):
 *   users, clients, hosting_plans, email_templates, automation_settings,
 *   company_settings, scheduler_logs, backups
 */
export const TABLE_ORDER = [
  "users",
  "clients",
  "hosting_plans",
  "email_templates",
  "automation_settings",
  "company_settings",
  "scheduler_logs",
  "backups",
  "refresh_tokens",
  "password_reset_tokens",
  "audit_logs",
  "hosting_services",
  "domains",
  "payment_notices",
  "support_tickets",
  "payments",
  "support_ticket_messages",
  "payment_reminder_logs",
  "internal_tasks",
  "email_logs",
];

// Columna(s) que forman la clave primaria de cada tabla — todas son `id`
// único (UUID o, en email_templates, un código de texto), ninguna tiene PK
// compuesta en este schema.
export const PRIMARY_KEY = Object.fromEntries(TABLE_ORDER.map((t) => [t, "id"]));

// Secuencias que generan identificadores de negocio (no PKs) y que hay que
// reposicionar después de importar datos históricos con esos valores ya
// asignados — ver reset-sequences en import-mariadb.mjs.
export const BUSINESS_SEQUENCES = [
  {
    table: "payment_notices",
    column: "notice_number",
    sequence: "payment_notice_number_seq",
    // 'AV-2026-0042' -> 42
    parseNumber: (value) => {
      const match = /^AV-\d{4}-(\d+)$/.exec(value ?? "");
      return match ? parseInt(match[1], 10) : null;
    },
  },
  {
    table: "support_tickets",
    column: "ticket_number",
    sequence: "support_ticket_number_seq",
    // 'TK-2026-0007' -> 7
    parseNumber: (value) => {
      const match = /^TK-\d{4}-(\d+)$/.exec(value ?? "");
      return match ? parseInt(match[1], 10) : null;
    },
  },
];

if (new Set(TABLE_ORDER).size !== TABLE_ORDER.length) {
  throw new Error("table-order.js: TABLE_ORDER tiene un nombre de tabla duplicado");
}
