-- ============================================================
-- Bitlogic Client Hub — Schema consolidado para MariaDB
-- ============================================================
--
-- QUÉ ES ESTE ARCHIVO
-- Representa, en sintaxis MariaDB, el estado ACTUAL completo del sistema
-- (equivalente al resultado combinado de las 16 migraciones de PostgreSQL en
-- backend/src/migrations/001..016). No es una conversión línea por línea de
-- esas migraciones — es un schema inicial nuevo, consolidado, tal como se
-- decidió en la auditoría de migración (opción B: "schema inicial
-- consolidado" en vez de convertir las 16 migraciones una por una).
--
-- ESTADO: preparación únicamente (Fase DB-1). Este archivo TODAVÍA NO está
-- conectado a ningún runner (`backend/src/db/migrate.js` sigue apuntando
-- solo a las migraciones de Postgres) y no se ejecutó contra ninguna base
-- real ni de prueba. Las 16 migraciones de Postgres NO se borraron — siguen
-- siendo la fuente de verdad mientras el motor productivo sea PostgreSQL.
--
-- REQUIERE: MariaDB 10.5+ como piso técnico (RETURNING en INSERT/DELETE para
-- cuando se conviertan más queries, CREATE SEQUENCE, DEFAULT (UUID()) y CHECK,
-- todos disponibles desde 10.2/10.3). Validado además contra la versión real
-- del VPS, MariaDB 11.4.10 (Fase DB-2.5) — ver docs/MARIADB_MIGRATION.md.
--
-- DECISIONES DE CONVERSIÓN (detalle completo en el informe de la Fase DB-1):
--   - UUID de Postgres (gen_random_uuid()) -> CHAR(36) con DEFAULT (UUID()).
--     Nota: UUID() de MariaDB es v1 (timestamp+MAC), no v4 random como
--     pgcrypto. Aceptable como puente para esta fase; recomendado pasar a
--     generación en la app (crypto.randomUUID()) cuando se toquen los
--     services en la Fase DB-3.
--   - Triggers reutilizables de "updated_at" (set_updated_at(),
--     update_internal_tasks_updated_at(), etc.) -> eliminados por completo,
--     reemplazados por el atributo nativo de columna
--     `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` (sin trigger).
--   - generate_ticket_number() (llamada como DEFAULT de columna en Postgres,
--     no soportado de forma confiable en MariaDB) -> trigger BEFORE INSERT
--     dedicado en support_tickets, ver más abajo.
--   - enforce_single_company_settings() -> trigger BEFORE INSERT con
--     SIGNAL SQLSTATE '45000' en vez de RAISE EXCEPTION.
--   - FK circular payments<->payment_notices del bloque `DO $$` de la
--     migración 003 -> ya no aplica: en este schema consolidado
--     payment_notices se crea antes que payments y la FK se declara inline,
--     sin necesidad de ningún mecanismo de idempotencia para agregarla después.
--   - Índice parcial (`WHERE revoked_at IS NULL`) en refresh_tokens -> índice
--     compuesto (revoked_at, expires_at), sin equivalente parcial en MariaDB.
--   - Columnas TEXT usadas como PRIMARY KEY o UNIQUE (8 en total — más de las
--     2 detectadas en la auditoría original, corregido acá tras leer las 16
--     migraciones completas) -> VARCHAR acotado, requerido por InnoDB para
--     poder indexarlas. Detalle por tabla en los comentarios de cada columna.
--   - Columnas TEXT con índice simple (no único) -> se mantienen TEXT, el
--     índice se crea con un prefijo de longitud fijo `(191)` (límite seguro
--     para utf8mb4 en InnoDB sin depender de innodb_large_prefix).
--   - JSONB -> JSON (MariaDB no tiene un tipo binario indexado equivalente;
--     no hace falta acá porque no hay operadores de consulta JSON en uso,
--     confirmado en la auditoría — solo se lee/escribe el blob completo).
--   - TIMESTAMPTZ -> DATETIME. Política: todo en UTC, la conversión a
--     horario de Argentina (America/Argentina/Buenos_Aires, UTC-3 fijo) se
--     hace en la capa de presentación, nunca en SQL.
--   - NUMERIC(p,s) -> DECIMAL(p,s), sin pérdida de precisión (crítico para
--     montos de facturación).
--
-- Motor e idioma: InnoDB (requerido para FKs y transacciones) + utf8mb4 con
-- collation utf8mb4_unicode_520_ci (la misma que usa el VPS real, ver
-- character_set_server/collation_server en su configuración) como default de
-- TODAS las tablas (normalizado globalmente en la Fase DB-2.5 — antes solo
-- estaba en algunas tablas y generaba FKs con collation cruzada, ver más
-- abajo). 6 columnas puntuales usan `COLLATE utf8mb4_bin` en vez del default
-- de tabla: son identificadores técnicos/hashes comparados exacto, no texto
-- de negocio buscable — token_hash (refresh_tokens y password_reset_tokens),
-- ticket_number, notice_number, automation_settings.key y email_templates.id.
-- En Postgres estas columnas eran TEXT con comparación case-sensitive por
-- default; con la collation `_520_ci` de las demás columnas pasarían a
-- case-insensitive sin querer. email/domain (users, clients,
-- hosting_services, domains) SÍ se dejan case-insensitive a propósito —
-- coincide con la normalización .toLowerCase() ya existente en el código y
-- con el uso de ILIKE para búsqueda de dominios.
--
-- CÓMO EJECUTAR ESTE ARCHIVO (cuando llegue la Fase DB-2): está pensado para
-- correr vía el cliente `mariadb`/`mysql` (ej. `mariadb -u user -p db <
-- schema.sql`), no vía pool.query() de un driver — usa `DELIMITER` para los
-- triggers con cuerpo multi-sentencia, que es una directiva del cliente CLI,
-- no SQL real, y fallaría si se manda tal cual a través de mysql2/pg. Definir
-- el mecanismo de ejecución final (CLI vs. adaptar `db/migrate.js`) queda
-- para la Fase DB-2, fuera del alcance de esta fase.

-- ============================================================
-- Secuencias (MariaDB 10.3+ soporta CREATE SEQUENCE / NEXTVAL nativamente,
-- sintaxis casi idéntica a Postgres)
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS payment_notice_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 1 INCREMENT BY 1;

-- ============================================================
-- users
-- (incluye la columna `notifications`, agregada en Postgres por la
-- migración 013 — este schema consolidado ya la trae desde el inicio)
-- ============================================================

-- NOTA DE COLLATION — RESUELTA EN LA FASE DB-2.5 (historial: en la Fase
-- DB-3A se había intentado utf8mb4_unicode_520_ci solo en
-- users/refresh_tokens/password_reset_tokens, y falló la creación del schema
-- completo contra MariaDB real con errno 150 "Foreign key constraint is
-- incorrectly formed" — InnoDB exige que una FK y la columna que referencia
-- tengan la MISMA collation, no alcanza con el mismo tipo. users.id es
-- referenciado por FKs de support_tickets, support_ticket_messages,
-- internal_tasks y audit_logs, que en ese momento seguían en
-- utf8mb4_unicode_ci. Se quedó documentado como dependencia pendiente en vez
-- de tocar esos otros dominios). La Fase DB-2.5 normalizó TODAS las tablas a
-- utf8mb4_unicode_520_ci de una sola vez, eliminando el problema de raíz.

CREATE TABLE IF NOT EXISTS users (
  -- DEFAULT (UUID()) se mantiene a propósito: seeds/006_client_users_seed.js
  -- (seed DEMO, fuera de alcance de esta fase) inserta usuarios sin enviar
  -- id explícito y depende de este default. La política de la Fase DB-3A
  -- (generar UUID v4 en Node) ya se aplica en los flujos de producción
  -- (users.service.js, seeds/001_admin_seed.js) — no se retira el default
  -- hasta que ese seed demo se actualice o se elimine, documentado acá tal
  -- como pide la Fase 2.
  id            CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name          TEXT          NOT NULL,
  email         VARCHAR(255)  NOT NULL,                 -- TEXT+UNIQUE en Postgres -> acotado para indexar
  password_hash TEXT          NOT NULL,
  role          TEXT          NOT NULL,
  status        TEXT          NOT NULL DEFAULT 'active',
  phone         TEXT,
  client_id     CHAR(36),
  last_login_at DATETIME,
  notifications JSON          NOT NULL DEFAULT '{"emailPayments":true,"emailTickets":true,"whatsapp":false,"weeklyReport":true}',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_role_check   CHECK (role   IN ('super_admin','admin','soporte','finanzas','cliente')),
  CONSTRAINT users_status_check CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role(191));

-- ============================================================
-- refresh_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  -- Sin DEFAULT (UUID()): el único INSERT (auth.service.js issueRefreshToken)
  -- ya envía id explícito (randomUUID() de Node) desde antes de esta fase.
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(64)  COLLATE utf8mb4_bin NOT NULL,  -- sha256 hex (auth.service.js) = 64 chars exactos; comparación exacta, no case-insensitive
  expires_at DATETIME     NOT NULL,
  revoked_at DATETIME,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
-- Reemplaza el índice parcial de Postgres (WHERE revoked_at IS NULL), sin
-- equivalente en MariaDB: índice compuesto que cubre el mismo patrón de
-- consulta (tokens no revocados por vencer).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_expires ON refresh_tokens (revoked_at, expires_at);

-- ============================================================
-- clients
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  -- Sin DEFAULT (UUID()): el único INSERT (clients.service.js createClient)
  -- ya envía id explícito (randomUUID() de Node) desde la Fase DB-3B.
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  name        TEXT          NOT NULL,
  company     TEXT,
  email       TEXT          NOT NULL,
  phone       TEXT,
  tax_id      TEXT,
  status      TEXT          NOT NULL DEFAULT 'active',
  notes       TEXT,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT clients_status_check CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_clients_email   ON clients (email(191));
CREATE INDEX IF NOT EXISTS idx_clients_status  ON clients (status(191));
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients (company(191));

-- ============================================================
-- hosting_plans
-- ============================================================

CREATE TABLE IF NOT EXISTS hosting_plans (
  -- Sin DEFAULT (UUID()): el único INSERT (plans.service.js createPlan;
  -- hosting.service.js createPlan también, aunque inalcanzable por HTTP hoy
  -- por el orden de montaje de rutas en app.js) ya envía id explícito
  -- (randomUUID() de Node) desde la Fase DB-3C.
  id              CHAR(36)       NOT NULL PRIMARY KEY,
  name            TEXT           NOT NULL,
  description     TEXT,
  storage_gb      INT            NOT NULL,
  websites_limit  INT,           -- NULL = ilimitados
  emails_limit    INT,           -- NULL = ilimitados
  monthly_price   DECIMAL(12,2)  NOT NULL,
  status          TEXT           NOT NULL DEFAULT 'active',
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT hosting_plans_status_check CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_hosting_plans_status ON hosting_plans (status(191));

-- ============================================================
-- hosting_services
-- ============================================================

CREATE TABLE IF NOT EXISTS hosting_services (
  -- Sin DEFAULT (UUID()): el único INSERT (hosting.service.js createService)
  -- ya envía id explícito (randomUUID() de Node) desde la Fase DB-3C.
  id                CHAR(36)       NOT NULL PRIMARY KEY,
  client_id         CHAR(36)       NOT NULL,
  plan_id           CHAR(36)       NOT NULL,
  domain            VARCHAR(255)   NOT NULL,             -- TEXT+UNIQUE en Postgres -> acotado
  status            TEXT           NOT NULL DEFAULT 'active',
  monthly_price     DECIMAL(12,2)  NOT NULL,
  setup_date        DATE           NOT NULL,
  next_due_date     DATE           NOT NULL,
  storage_used_gb   DECIMAL(10,2)  NOT NULL DEFAULT 0,
  storage_total_gb  DECIMAL(10,2)  NOT NULL,
  emails_used       INT            NOT NULL DEFAULT 0,
  emails_total      INT,           -- NULL = ilimitados
  hestia_username   TEXT,
  hestia_url        TEXT,
  internal_notes    TEXT,
  created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT hosting_services_status_check CHECK (
    status IN ('active', 'due_soon', 'pending_payment', 'overdue', 'suspended', 'cancelled')
  ),
  CONSTRAINT hosting_services_domain_unique UNIQUE (domain),
  CONSTRAINT hosting_services_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT hosting_services_plan_id_fkey   FOREIGN KEY (plan_id)   REFERENCES hosting_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_hosting_services_client_id ON hosting_services (client_id);
CREATE INDEX IF NOT EXISTS idx_hosting_services_plan_id   ON hosting_services (plan_id);
CREATE INDEX IF NOT EXISTS idx_hosting_services_status    ON hosting_services (status(191));
CREATE INDEX IF NOT EXISTS idx_hosting_services_next_due  ON hosting_services (next_due_date);

-- ============================================================
-- payment_notices
-- (creada ANTES que payments para que la FK de payments hacia acá se pueda
-- declarar inline, sin el mecanismo de idempotencia que usaba la migración
-- 003 de Postgres para una referencia circular que en la práctica no existe
-- en este sentido — payment_notices no referencia a payments)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_notices (
  id                  CHAR(36)       NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  client_id           CHAR(36)       NOT NULL,
  hosting_service_id  CHAR(36)       NOT NULL,
  notice_number       VARCHAR(50)    COLLATE utf8mb4_bin NOT NULL, -- TEXT+UNIQUE en Postgres -> acotado. Generado en JS vía NEXTVAL, sin cambios de service. Comparación exacta, no case-insensitive.
  period_month        INT            NOT NULL,
  period_year         INT            NOT NULL,
  issue_date          DATE           NOT NULL DEFAULT (CURDATE()),
  due_date            DATE           NOT NULL,
  amount              DECIMAL(12,2)  NOT NULL,
  status              TEXT           NOT NULL DEFAULT 'pending',
  sent_at             DATETIME,
  paid_at             DATETIME,
  notes               TEXT,
  created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT payment_notices_number_unique UNIQUE (notice_number),
  CONSTRAINT payment_notices_status_check  CHECK (status IN ('draft','pending','sent','paid','overdue','cancelled')),
  CONSTRAINT payment_notices_client_id_fkey  FOREIGN KEY (client_id)          REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT payment_notices_service_id_fkey FOREIGN KEY (hosting_service_id) REFERENCES hosting_services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_payment_notices_client_id  ON payment_notices (client_id);
CREATE INDEX IF NOT EXISTS idx_payment_notices_service_id ON payment_notices (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_payment_notices_status     ON payment_notices (status(191));
CREATE INDEX IF NOT EXISTS idx_payment_notices_period     ON payment_notices (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payment_notices_due_date   ON payment_notices (due_date);

-- ============================================================
-- payments
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  CHAR(36)       NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  client_id           CHAR(36)       NOT NULL,
  hosting_service_id  CHAR(36),
  payment_notice_id   CHAR(36),
  period_month        INT            NOT NULL,
  period_year         INT            NOT NULL,
  amount              DECIMAL(12,2)  NOT NULL,
  method              TEXT           NOT NULL DEFAULT 'manual',
  status              TEXT           NOT NULL DEFAULT 'pending',
  paid_at             DATETIME,
  reference           TEXT,
  internal_notes      TEXT,
  created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT payments_method_check CHECK (method IN ('manual','transfer','cash','mercadopago','paypal')),
  CONSTRAINT payments_status_check CHECK (status IN ('pending','paid','overdue','cancelled')),
  CONSTRAINT payments_client_id_fkey  FOREIGN KEY (client_id)          REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT payments_service_id_fkey FOREIGN KEY (hosting_service_id) REFERENCES hosting_services(id) ON DELETE SET NULL,
  CONSTRAINT payments_notice_id_fkey  FOREIGN KEY (payment_notice_id)  REFERENCES payment_notices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_payments_client_id  ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_id ON payments (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_payments_notice_id  ON payments (payment_notice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments (status(191));
CREATE INDEX IF NOT EXISTS idx_payments_period     ON payments (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at    ON payments (paid_at);

-- ============================================================
-- domains
-- ============================================================

CREATE TABLE IF NOT EXISTS domains (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  client_id           CHAR(36)      NOT NULL,
  hosting_service_id  CHAR(36),
  domain              VARCHAR(255)  NOT NULL,            -- TEXT+UNIQUE en Postgres -> acotado
  registrar           TEXT,
  registration_date   DATE,
  expiration_date     DATE          NOT NULL,
  auto_renew          BOOLEAN       DEFAULT false,
  annual_cost         DECIMAL(12,2),
  customer_price      DECIMAL(12,2),
  status              TEXT          NOT NULL DEFAULT 'active',
  notes               TEXT,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT domains_status_check   CHECK (status IN ('active', 'due_soon', 'expired', 'transferred', 'cancelled')),
  CONSTRAINT domains_domain_unique  UNIQUE (domain),
  CONSTRAINT domains_client_id_fkey  FOREIGN KEY (client_id)          REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT domains_service_id_fkey FOREIGN KEY (hosting_service_id) REFERENCES hosting_services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_domains_client_id       ON domains (client_id);
CREATE INDEX IF NOT EXISTS idx_domains_service_id      ON domains (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_domains_status          ON domains (status(191));
CREATE INDEX IF NOT EXISTS idx_domains_expiration_date ON domains (expiration_date);

-- ============================================================
-- support_tickets
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id                  CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  ticket_number       VARCHAR(50)  COLLATE utf8mb4_bin NOT NULL, -- TEXT+UNIQUE en Postgres -> acotado. Autogenerado por trigger, ver abajo. Comparación exacta, no case-insensitive.
  client_id           CHAR(36)     NOT NULL,
  hosting_service_id  CHAR(36),
  subject             TEXT         NOT NULL,
  priority            TEXT         NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status               TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  assigned_to         CHAR(36),
  created_by          CHAR(36),
  last_message_at     DATETIME,
  resolved_at         DATETIME,
  closed_at           DATETIME,
  created_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT support_tickets_number_unique UNIQUE (ticket_number),
  CONSTRAINT support_tickets_client_id_fkey  FOREIGN KEY (client_id)          REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT support_tickets_service_id_fkey FOREIGN KEY (hosting_service_id) REFERENCES hosting_services(id) ON DELETE SET NULL,
  CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT support_tickets_created_by_fkey  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_support_tickets_client_id   ON support_tickets (client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status      ON support_tickets (status(191));
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority    ON support_tickets (priority(191));
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at  ON support_tickets (created_at DESC);

-- Reemplaza generate_ticket_number() de Postgres (llamada como DEFAULT de
-- columna, patrón no soportado de forma confiable en MariaDB). Mismo
-- formato exacto: TK-{YYYY}-{NNNN con padding a 4 dígitos}. No requiere
-- ningún cambio en support.service.js — sigue sin pasar ticket_number en el
-- INSERT, tal como hace hoy contra Postgres.
DROP TRIGGER IF EXISTS trg_support_tickets_number;
DELIMITER $$
CREATE TRIGGER trg_support_tickets_number
BEFORE INSERT ON support_tickets
FOR EACH ROW
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    SET NEW.ticket_number = CONCAT('TK-', YEAR(CURDATE()), '-', LPAD(NEXTVAL(support_ticket_number_seq), 4, '0'));
  END IF;
END$$
DELIMITER ;

-- ============================================================
-- support_ticket_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id             CHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  ticket_id      CHAR(36)  NOT NULL,
  sender_user_id CHAR(36),
  sender_name    TEXT      NOT NULL,
  sender_role    TEXT      NOT NULL,
  message        TEXT      NOT NULL,
  is_internal    BOOLEAN   DEFAULT false,
  created_at     DATETIME  DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_ticket_messages_sender_fkey     FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id  ON support_ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_created_at ON support_ticket_messages (created_at DESC);

-- ============================================================
-- internal_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS internal_tasks (
  id                  CHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  title               TEXT      NOT NULL,
  description         TEXT,
  status              TEXT      NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority            TEXT      NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to         CHAR(36),
  created_by          CHAR(36),
  client_id           CHAR(36),
  hosting_service_id  CHAR(36),
  domain_id           CHAR(36),
  support_ticket_id   CHAR(36),
  due_date            DATE,
  completed_at        DATETIME,
  created_at          DATETIME  DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT internal_tasks_assigned_to_fkey FOREIGN KEY (assigned_to)        REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT internal_tasks_created_by_fkey  FOREIGN KEY (created_by)         REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT internal_tasks_client_id_fkey   FOREIGN KEY (client_id)          REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT internal_tasks_service_id_fkey  FOREIGN KEY (hosting_service_id) REFERENCES hosting_services(id) ON DELETE SET NULL,
  CONSTRAINT internal_tasks_domain_id_fkey   FOREIGN KEY (domain_id)          REFERENCES domains(id) ON DELETE SET NULL,
  CONSTRAINT internal_tasks_ticket_id_fkey   FOREIGN KEY (support_ticket_id)  REFERENCES support_tickets(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_internal_tasks_status      ON internal_tasks (status(191));
CREATE INDEX IF NOT EXISTS idx_internal_tasks_priority    ON internal_tasks (priority(191));
CREATE INDEX IF NOT EXISTS idx_internal_tasks_assigned_to ON internal_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_due_date    ON internal_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_client_id   ON internal_tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_service_id  ON internal_tasks (hosting_service_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_domain_id   ON internal_tasks (domain_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_ticket_id   ON internal_tasks (support_ticket_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_created_at  ON internal_tasks (created_at DESC);

-- ============================================================
-- email_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id                   CHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  type                 TEXT      NOT NULL,
  recipient            TEXT      NOT NULL,
  subject              TEXT      NOT NULL,
  status               TEXT      NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id  TEXT,
  error_message        TEXT,
  related_client_id    CHAR(36),
  related_notice_id    CHAR(36),
  related_ticket_id    CHAR(36),
  related_domain_id    CHAR(36),
  sent_at              DATETIME,
  created_at           DATETIME  DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT email_logs_client_id_fkey FOREIGN KEY (related_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT email_logs_notice_id_fkey FOREIGN KEY (related_notice_id) REFERENCES payment_notices(id) ON DELETE SET NULL,
  CONSTRAINT email_logs_ticket_id_fkey FOREIGN KEY (related_ticket_id) REFERENCES support_tickets(id) ON DELETE SET NULL,
  CONSTRAINT email_logs_domain_id_fkey FOREIGN KEY (related_domain_id) REFERENCES domains(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_email_logs_status     ON email_logs (status(191));
CREATE INDEX IF NOT EXISTS idx_email_logs_type       ON email_logs (type(191));
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient  ON email_logs (recipient(191));
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id  ON email_logs (related_client_id);

-- ============================================================
-- audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  -- Sin DEFAULT (UUID()): el único INSERT (audit.service.js logAction) ya
  -- envía id explícito (randomUUID() de Node) desde la Fase DB-3D.
  id           CHAR(36)  NOT NULL PRIMARY KEY,
  user_id      CHAR(36),
  user_name    TEXT      NOT NULL,
  user_role    TEXT      NOT NULL,
  action       TEXT      NOT NULL,
  entity_type  TEXT      NOT NULL,
  entity_id    TEXT      NOT NULL,
  entity_name  TEXT,
  old_values   JSON,
  new_values   JSON,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   DATETIME  DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id      ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type  ON audit_logs (entity_type(191));
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs (action(191));
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id    ON audit_logs (entity_id(191));
CREATE INDEX IF NOT EXISTS idx_audit_logs_combined     ON audit_logs (user_id, entity_type(191), created_at DESC);

-- ============================================================
-- scheduler_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduler_logs (
  id            CHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  job_name      TEXT      NOT NULL,
  status        TEXT      NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at   DATETIME,
  duration_ms   INT,
  summary       JSON,
  error_message TEXT,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_job_name     ON scheduler_logs (job_name(191));
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_status       ON scheduler_logs (status(191));
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_created_at   ON scheduler_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_logs_job_created  ON scheduler_logs (job_name(191), created_at DESC);

-- ============================================================
-- automation_settings (incluye los defaults que la migración 010 de
-- Postgres inserta con ON CONFLICT DO NOTHING -> INSERT IGNORE acá)
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_settings (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  `key`       VARCHAR(100) COLLATE utf8mb4_bin NOT NULL, -- TEXT+UNIQUE en Postgres -> acotado; `key` es palabra reservada, escapada con backticks. Comparación exacta: son claves de código (ej. 'reminder_7_days'), no texto de negocio.
  value       JSON         NOT NULL DEFAULT '{}',
  description TEXT,
  enabled     BOOLEAN      NOT NULL DEFAULT true,
  updated_by  CHAR(36),
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT automation_settings_key_unique UNIQUE (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_automation_settings_key     ON automation_settings (`key`);
CREATE INDEX IF NOT EXISTS idx_automation_settings_enabled ON automation_settings (enabled);

INSERT IGNORE INTO automation_settings (`key`, description, value, enabled)
VALUES
  ('reminder_7_days', 'Send email reminder 7 days before due date', '{"enabled": false, "emailTemplate": "payment_reminder_7d"}', false),
  ('reminder_3_days', 'Send email reminder 3 days before due date', '{"enabled": false, "emailTemplate": "payment_reminder_3d"}', false),
  ('reminder_due_today', 'Send email reminder on due date', '{"enabled": false, "emailTemplate": "payment_reminder_due"}', false),
  ('reminder_overdue_7days', 'Send email reminder 7+ days after due date', '{"enabled": false, "emailTemplate": "payment_reminder_overdue"}', false),
  ('delinquency_create_task', 'Create task when payment is 7+ days overdue', '{"enabled": false, "taskTemplate": "mora_pago"}', false),
  ('hestia_sync_enabled', 'Automatically sync storage usage from HestiaCP daily', '{"enabled": false, "schedule": "02:00"}', false),
  ('notification_recipients_admin', 'Email addresses to notify on critical events', '{"emails": []}', true),
  ('notification_recipients_finance', 'Email addresses for finance notifications', '{"emails": []}', true);

-- ============================================================
-- payment_reminder_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_reminder_logs (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  notice_id     CHAR(36)     NOT NULL,
  reminder_type VARCHAR(50)  NOT NULL,                  -- TEXT en Postgres, parte de un UNIQUE INDEX compuesto -> acotado
  recipient     TEXT         NOT NULL,
  sent_date     DATE         NOT NULL DEFAULT (CURDATE()),
  sent_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  status        TEXT         NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT payment_reminder_logs_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES payment_notices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_reminder_logs_unique
  ON payment_reminder_logs (notice_id, reminder_type, sent_date);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_notice_id ON payment_reminder_logs (notice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_type      ON payment_reminder_logs (reminder_type);
CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_sent_at   ON payment_reminder_logs (sent_at DESC);

-- ============================================================
-- company_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  company_name  TEXT         NOT NULL,
  contact_email TEXT,
  phone         TEXT,
  tax_id        TEXT,
  address       TEXT,
  currency      TEXT         NOT NULL DEFAULT 'ARS',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT company_settings_currency_check CHECK (currency IN ('ARS', 'USD', 'EUR'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

-- Reemplaza enforce_single_company_settings() de Postgres (RAISE EXCEPTION
-- -> SIGNAL SQLSTATE). Mismo comportamiento: no permite una segunda fila.
DROP TRIGGER IF EXISTS trg_company_settings_single_row;
DELIMITER $$
CREATE TRIGGER trg_company_settings_single_row
BEFORE INSERT ON company_settings
FOR EACH ROW
BEGIN
  IF (SELECT COUNT(*) FROM company_settings) >= 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se permite una configuracion de empresa';
  END IF;
END$$
DELIMITER ;

-- ============================================================
-- email_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id         VARCHAR(100)  COLLATE utf8mb4_bin NOT NULL PRIMARY KEY, -- TEXT PRIMARY KEY en Postgres -> acotado. Valores cortos: 'venc', 'pago_ok', etc. Comparación exacta: son claves de código, no texto de negocio.
  subject    TEXT          NOT NULL,
  body       TEXT          NOT NULL,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

-- ============================================================
-- backups
-- ============================================================

CREATE TABLE IF NOT EXISTS backups (
  id         CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name       TEXT          NOT NULL,
  type       TEXT          NOT NULL DEFAULT 'database',
  size_mb    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status     TEXT          NOT NULL DEFAULT 'in_progress',
  file_path  TEXT,
  notes      TEXT,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT backups_type_check   CHECK (type   IN ('database', 'files', 'full')),
  CONSTRAINT backups_status_check CHECK (status IN ('success', 'failed', 'in_progress'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

-- ============================================================
-- password_reset_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  -- Sin DEFAULT (UUID()): el único INSERT (auth.service.js forgotPassword)
  -- ahora envía id explícito (randomUUID() de Node) — antes de la Fase
  -- DB-3A dependía del default, se corrigió como parte de la política de
  -- UUID (Fase 2).
  id         CHAR(36)     NOT NULL PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  token_hash VARCHAR(64)  COLLATE utf8mb4_bin NOT NULL,  -- sha256 hex (auth.service.js) = 64 chars exactos; comparación exacta, no case-insensitive
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci;

CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id    ON password_reset_tokens (user_id);
