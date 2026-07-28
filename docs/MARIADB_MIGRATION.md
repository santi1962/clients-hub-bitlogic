# Migración PostgreSQL → MariaDB — estado y guía

**Decisión definitiva del usuario:** el motor productivo de Bitlogic Client Hub pasa a ser MariaDB/MySQL (el VPS real usa MariaDB 11.4.10 vía HestiaCP). PostgreSQL sigue siendo el motor **activo hoy** — esta migración se hace de a un dominio funcional por vez, sin apagar Postgres hasta que todos los módulos y los datos reales estén validados contra MariaDB.

**No cambiar `DATABASE_URL` a `mysql://` en ningún ambiente real todavía.** Solo el dominio auth/users tiene sus queries convertidas (ver más abajo) — el resto de los módulos (clientes, hosting, dominios, facturación, soporte, tareas, configuración, backups, scheduler) siguen escritos en sintaxis PostgreSQL y romperían contra MariaDB.

## Fases completadas

| Fase | Qué hizo | Estado |
|---|---|---|
| DB-0 / DB-1 | Rama `migration/mariadb`, instaló `mysql2` (sin sacar `pg`), reescribió `db/pool.js` como capa de compatibilidad dual-driver, `config/index.js` detecta el motor por el esquema de `DATABASE_URL`, creó `db/schema.sql` (schema MariaDB consolidado, validado contra MariaDB 10.4 real) | ✅ |
| DB-3A | Convirtió el dominio auth/users (`users`, `refresh_tokens`, `password_reset_tokens`) para funcionar contra ambos motores | ✅ |
| DB-2.5 | Normalizó la collation de **todo** `db/schema.sql` a `utf8mb4_unicode_520_ci` (la del VPS real), creó `backend/scripts/apply-mariadb-schema.mjs` (runner reproducible del schema), validó todo contra MariaDB **11.4.12** real (Docker, no 10.4), corrigió la idempotencia de los triggers, y blindó estructuralmente los fixtures de test | ✅ |
| DB-3B en adelante | Resto de los módulos (clientes, hosting, dominios, facturación, soporte, tareas, configuración, backups, scheduler) | ⏳ pendiente |

## Cómo se elige el motor

`backend/src/config/index.js` deriva `config.db.driver` (`"postgres"` o `"mysql"`) del esquema de `DATABASE_URL`:

```
postgresql://...  → postgres (default histórico, también el fallback si el esquema no se reconoce)
postgres://...    → postgres
mysql://...       → mysql
mysql2://...      → mysql
```

`backend/src/db/pool.js` expone la misma API pública sin importar el motor activo:

- `pool.query(sql, params)` → `Promise<{ rows, rowCount }>`
- `pool.connect()` → `Promise<{ query(sql, params), release() }>` (transacciones manuales, `BEGIN`/`COMMIT`/`ROLLBACK` como SQL crudo — funciona igual en ambos drivers)
- `pool.on("error", cb)`, `pool.end()`

Cuando el motor es Postgres, `pool.js` devuelve el `pg.Pool` real (envuelto solo lo mínimo, ver abajo) — cero cambio de comportamiento respecto a antes de esta migración. Cuando es MariaDB, envuelve `mysql2/promise` normalizando su resultado `[rows, fields]`/`ResultSetHeader` al shape `{rows, rowCount}` de `pg`.

### Placeholders: `?` vs `$1,$2,...`

Las queries **ya convertidas** (dominio auth/users) están escritas con `?` (sintaxis nativa de MariaDB). `pool.js` traduce automáticamente `?` → `$1,$2,...` cuando el driver activo es Postgres — **solo si la query no contiene ya un patrón `$N`**, así conviven sin conflicto con los módulos todavía no convertidos (que siguen usando `$1,$2,...` directo, sin pasar por ninguna traducción). No es un parser SQL genérico: es un reemplazo mecánico por orden de aparición, pensado para queries escritas a mano por el equipo — no contempla un `?` literal dentro de un string o comentario SQL.

**Importante para quien convierta el próximo módulo:** al escribir una query nueva en `?`, los parámetros van en el **mismo orden en que aparecen los `?` en el texto** (a diferencia de `$1,$2`, donde el mismo parámetro se puede referenciar en cualquier orden). Varias queries de Postgres en este proyecto tenían `$2` apareciendo antes que `$1` en el texto (ej. `SET password_hash = $2 ... WHERE id = $1` con params `[id, hash]`) — al convertir, hay que reordenar el array de parámetros para que coincida con el orden textual de los `?`.

### `RETURNING`

- `INSERT ... RETURNING` / `DELETE ... RETURNING`: MariaDB 10.5+/10.0.5+ los soporta nativo, pero **no se usó** en la conversión de auth/users — se prefirió una estrategia única para los tres casos (ver abajo), más simple de testear y sin dos caminos de código por motor.
- `UPDATE ... RETURNING`: MariaDB no lo soporta (recién en 13.0, no disponible en producción). Se reemplaza por `UPDATE ...` + `SELECT ...` con la **misma condición exacta** del `WHERE`, chequeando `rowCount === 0` para el caso "no encontrado" antes de hacer el SELECT. Cuando el flujo tiene más de una escritura relacionada (ej. `resetPassword` en `users.service.js`, que además revoca refresh tokens), las dos operaciones + el SELECT final corren en una sola transacción (`pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`).
- `DELETE ... RETURNING id`: si el único dato que se necesita de vuelta es el `id` que ya se mandó por parámetro, no hace falta ningún SELECT — se devuelve el mismo id tras confirmar `rowCount > 0` (ver `deletePortalUser`).

### `ON CONFLICT` vs `INSERT IGNORE`/`ON DUPLICATE KEY UPDATE`

No tienen sintaxis común — es el único caso donde una query varía según el driver activo (`config.db.driver`), en vez de una sola query con `?` para ambos motores. Ver `backend/src/seeds/001_admin_seed.js` para el patrón exacto (rama explícita `if (config.db.driver === "mysql") ... else ...`).

### Errores normalizados

`pool.js` normaliza el código de "entrada duplicada" de `mysql2` (`errno 1062` / `ER_DUP_ENTRY`) a `23505` (el código SQLSTATE que ya usa Postgres para `unique_violation`) — es el único código de error que el backend efectivamente chequea hoy (`users.controller.js` ante un email duplicado). No hay una tabla de mapeo genérica de errores, solo esta normalización puntual.

### JSON

**MariaDB no tiene un tipo JSON binario real** (a diferencia de MySQL 8) — es un alias de `LONGTEXT` con un `CHECK (JSON_VALID(...))`. A nivel de metadata de columna llega como `"BLOB"`, indistinguible de una columna de texto cualquiera — por eso `pool.js` **no puede** parsearlo de forma genérica y transparente (sí lo hace `pg` automáticamente para `jsonb`/`json`). Cada lugar que lea una columna JSON tiene que parsear el string de forma defensiva — ver `auth.service.js` (`formatUser()`, normaliza `notifications`). Si se convierte otro módulo con columnas JSON (`audit_logs`, `automation_settings`, `scheduler_logs`), va a necesitar el mismo patrón.

### Fechas — política UTC

`db/pool.js` fuerza `timezone: "Z"` en la conexión MariaDB. Todas las columnas de fecha/hora son `DATETIME` en UTC (sin equivalente de `TIMESTAMPTZ`) — la conversión a horario de Argentina se hace únicamente en la capa de presentación (frontend), nunca en SQL. Verificado con la expiración de refresh tokens y password reset tokens (`test/auth-mariadb.test.js`): un token vencido se rechaza y uno vigente no, sin corrimiento horario.

### UUID

**Política definitiva:** generar UUID v4 en Node (`crypto.randomUUID()`) y enviarlo explícito en cada `INSERT`, en vez de depender de `DEFAULT (UUID())` de la columna — ese default de MariaDB genera UUID v1 (timestamp+MAC), no v4 random como `gen_random_uuid()` de Postgres. Aplicado en:

- `refresh_tokens` — ya generaba el id en la app desde antes de esta fase.
- `password_reset_tokens` — se agregó en esta fase (antes dependía del default).
- `users` (vía `users.service.js` `createPortalUser`, y `seeds/001_admin_seed.js`, que ya usaba un id fijo).

### Política de UUID temporal — qué tabla conserva `DEFAULT (UUID())` y cuándo se retira

Ninguna tabla nueva se tocó en la Fase DB-2.5 (solo collation) — esta tabla documenta el estado real de las 20 tablas de `db/schema.sql`:

| Tabla | ¿Conserva `DEFAULT (UUID())`? | Quién lo retira | Fase futura |
|---|---|---|---|
| `refresh_tokens` | No (retirado en DB-3A) | — | — |
| `password_reset_tokens` | No (retirado en DB-3A) | — | — |
| `users` | **Sí** — `seeds/006_client_users_seed.js` (demo) inserta sin id explícito | Actualizar/eliminar ese seed demo | Sin fecha — no bloquea producción (los seeds demo no corren contra la base real, `docs/PRODUCTION_STATUS.md`) |
| `clients` | Sí | Módulo Clientes | DB-3B |
| `hosting_plans`, `hosting_services` | Sí | Módulo Servicios/Planes | DB-3C (sugerida) |
| `payment_notices`, `payments`, `payment_reminder_logs` | Sí | Módulo Facturación/Cobranza | Última (la más densa en incompatibilidades, ver recomendación de la Fase DB-3A) |
| `domains` | Sí | Módulo Dominios | A definir |
| `support_tickets`, `support_ticket_messages` | Sí | Módulo Soporte/Tickets | A definir |
| `internal_tasks` | Sí | Módulo Tareas | A definir |
| `email_logs` | Sí | Módulo Email/notificaciones | A definir |
| `audit_logs` | Sí | Transversal (lo escriben casi todos los módulos) — requiere pasada propia | A definir, probablemente al final |
| `scheduler_logs`, `automation_settings` | Sí | Módulo Scheduler/Automatizaciones | A definir |
| `company_settings` | Sí | Módulo Configuración | A definir |
| `backups` | Sí | Módulo Backups | A definir |
| `email_templates` | N/A — PK es `VARCHAR(100)` con id de código (`'venc'`, `'pago_ok'`), nunca fue UUID | — | — |

Regla general: no se retira ningún `DEFAULT (UUID())` hasta que el módulo dueño de esa tabla convierta sus queries y confirme que todos sus INSERT ya mandan id explícito (mismo criterio aplicado en DB-3A a `users`).

### Collation — normalización global (Fase DB-2.5)

**Resuelto.** El VPS real usa `character_set_server=utf8mb4`, `collation_server=utf8mb4_unicode_520_ci`. En la Fase DB-3A se había intentado aplicar esa collation solo a las 3 tablas de auth/users y falló la creación del schema completo (MariaDB real, errno 150 "Foreign key constraint is incorrectly formed") porque `users.id` es referenciado por FKs de `support_tickets`, `support_ticket_messages`, `internal_tasks` y `audit_logs`, que en ese momento seguían en `utf8mb4_unicode_ci` — InnoDB exige que una FK y la columna que referencia tengan la MISMA collation, no alcanza con el mismo tipo.

La Fase DB-2.5 normalizó **las 20 tablas** a `utf8mb4_unicode_520_ci` de una sola vez, eliminando el problema de raíz — validado contra MariaDB 11.4 real (ver más abajo).

**6 columnas usan `COLLATE utf8mb4_bin`** (comparación exacta/case-sensitive) en vez del default de tabla, porque son identificadores técnicos o hashes, no texto de negocio buscable — en Postgres estas columnas eran `TEXT` con comparación case-sensitive por default, y con `_520_ci` pasarían a case-insensitive sin querer:

- `refresh_tokens.token_hash`, `password_reset_tokens.token_hash` (sha256 hex)
- `support_tickets.ticket_number`, `payment_notices.notice_number` (identificadores de negocio, pero generados por código, no por un usuario tipeando)
- `automation_settings.key`, `email_templates.id` (claves de código, ej. `'reminder_7_days'`, `'venc'`)

`email`/`domain` (`users`, `clients`, `hosting_services`, `domains`) se dejan **case-insensitive** (default `_520_ci`) a propósito — coincide con la normalización `.toLowerCase()` ya existente en el código y con el uso de `ILIKE` para búsqueda de dominios. Nota: Postgres tenía el `UNIQUE` de estas columnas como case-sensitive por default (TEXT); MariaDB con `_520_ci` es ligeramente más estricto para prevenir duplicados (ej. "Ejemplo.com" y "ejemplo.com" se tratan como el mismo dominio) — evaluado como un cambio de comportamiento aceptable, no un bug, dado que la app ya trata email/domain como case-insensitive en la práctica.

Validado contra MariaDB 11.4 real: FK de `users`/`clients`/`hosting_plans`/`hosting_services`/`payment_notices`/`support_tickets` (`SET NULL`, `CASCADE` y `RESTRICT` según corresponda), `UNIQUE` de email/domain/notice_number/ticket_number, `CHECK` de roles/estados, comparación case-insensitive de email/domain, comparación exacta (case-sensitive) de token_hash/ticket_number/automation_settings.key, `JSON` inválido rechazado (`CHECK (json_valid(...))`, autogenerado por MariaDB en cada columna `JSON` — no hay que declararlo a mano), `DECIMAL(12,2)` sin error de punto flotante, texto utf8mb4 de 4 bytes (emoji) y con ñ/tildes.

### Runner reproducible del schema

`backend/scripts/apply-mariadb-schema.mjs` aplica `db/schema.sql` contra una base MariaDB de prueba, vía el cliente CLI `mariadb`/`mysql` (el schema usa `DELIMITER` para sus 2 triggers, no es SQL real y no se puede mandar vía `pool.query()` de ningún driver sin habilitar `multipleStatements` — deliberadamente **no** habilitado en el pool de la aplicación).

```bash
node backend/scripts/apply-mariadb-schema.mjs --url mysql://root:pass@127.0.0.1:13309/bitlogic_schema_test
node backend/scripts/apply-mariadb-schema.mjs --url mysql://... --dry-run   # solo valida, no ejecuta nada
```

Salvaguardas (sin override): requiere la URL explícita (`--url` o `MARIADB_SCHEMA_URL`, nunca `DATABASE_URL`), rechaza nombres de base que no contengan una palabra de una lista de "pinta de test" (test/dev/scratch/etc.), no crea la base de datos por sí solo (debe existir de antemano), no ejecuta seeds, aborta ante cualquier error sin ocultar nada con `IGNORE`.

**Idempotencia** (verificada corriendo el runner dos veces seguidas contra la misma base): `CREATE TABLE/INDEX/SEQUENCE IF NOT EXISTS` y el `INSERT IGNORE` de `automation_settings` ya eran idempotentes. Los 2 `CREATE TRIGGER` **no lo eran** (fallaban con "already exists" en la segunda corrida) — se corrigió agregando `DROP TRIGGER IF EXISTS` antes de cada uno. Con ese fix, el schema completo es reejecutable sin errores ni duplicados.

## Cómo probar contra ambos motores

### PostgreSQL (motor activo hoy)

```bash
cd backend
npm test
```

Usa el `DATABASE_URL` de `backend/.env` (el mismo de siempre). Sin cambios respecto a como funcionaba antes de esta migración.

### MariaDB (integración real, dominio auth/users)

Requiere una instancia MariaDB **descartable** — nunca la del VPS, nunca la productiva, nunca el XAMPP que uses para otros proyectos.

**Opción A — Docker (recomendada, permite fijar la versión exacta del VPS):**

```bash
docker pull mariadb:11.4
docker run -d --name bitlogic-mariadb-test --rm \
  -p 127.0.0.1:13400:3306 \
  -e MARIADB_ROOT_PASSWORD=throwaway_root_pw \
  mariadb:11.4 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_520_ci --default-time-zone=+00:00

cd backend
MARIADB_TEST_URL="mysql://root:throwaway_root_pw@127.0.0.1:13400/ignorado" npm test

docker stop bitlogic-mariadb-test   # --rm ya se encarga de borrar el contenedor y no deja volúmenes
```

**Opción B — binario portable/XAMPP como motor descartable** (si no hay Docker disponible), con datadir y puerto propios para no tocar la base de XAMPP que uses en otros proyectos:

```bash
mysql_install_db.exe -d "C:\ruta\a\datadir-descartable" -D
mysqld.exe --no-defaults --datadir="C:\ruta\a\datadir-descartable" --port=13309 --bind-address=127.0.0.1 --skip-grant-tables

cd backend
MARIADB_TEST_URL="mysql://root:@127.0.0.1:13309/ignorado" npm test

mysqladmin.exe --no-defaults -h127.0.0.1 -P13309 -uroot shutdown
```

Nota: la Opción B solo tiene la versión de MariaDB que traiga el XAMPP instalado (10.4 en esta máquina) — sirve para pruebas de queries/lógica, pero para validar el `schema.sql` en sí (collation, features específicas de 11.x) usar la Opción A.

Sin `MARIADB_TEST_URL`, `test/auth-mariadb.test.js` se saltea (no falla). Ver `docs/TESTING.md` para el detalle de qué prueba exactamente y por qué necesita un motor real (no alcanza con mocks para confirmar que el driver `mysql2` funciona).

**Nunca correr un fixture con escrituras (ej. `test/fixtures/mariadb-auth-flow.mjs`) por fuera de su test orquestador** — desde la Fase DB-2.5 hay dos protecciones independientes, ver `docs/TESTING.md`: `npm test` usa un glob explícito que nunca incluye `test/fixtures/` ni `test/helpers/`, y el fixture además tiene un guard propio (`MARIADB_FIXTURE_RUN=1`) por si se invoca directo.

## Riesgos pendientes

- **`seeds/006_client_users_seed.js`** (demo) todavía depende de `DEFAULT (UUID())` en `users.id` — bloquea retirar ese default hasta que se actualice o se elimine (ver tabla de política UUID arriba).
- **Cross-dependencias de otros módulos con `users`**: `settings.controller.js` (conteo de usuarios) y `routes/onboarding.routes.js` (existencia de usuario de portal) hacen `SELECT`/`EXISTS` directo contra `users` en sintaxis Postgres — no se tocaron (pertenecen a otros módulos), pero son la evidencia de que convertir un dominio no aísla completamente sus tablas de los demás módulos hasta que todos estén convertidos.
- El mensaje de log `"PostgreSQL conectado"` en `server.js` queda fijo sin importar el driver real activo — cosmético, no funcional, pendiente de prolijidad para una fase futura.
- El resto de las tablas (todo lo que no sea auth/users) tiene la collation ya alineada al VPS desde esta fase, pero sus queries de aplicación siguen sin convertir — cambiar `DATABASE_URL` a `mysql://` en cualquier ambiente real sigue rompiendo esos módulos.

## Resueltos en esta fase (ya no son riesgo)

- ~~Collation no alineada al VPS~~ — normalizada globalmente a `utf8mb4_unicode_520_ci`.
- ~~Versión real del VPS no probada~~ — validado contra MariaDB 11.4.12 real (Docker), no solo 10.4.
- ~~Triggers no idempotentes~~ — corregido con `DROP TRIGGER IF EXISTS`.
- ~~Fixtures con escrituras podían auto-ejecutarse por descubrimiento de `node --test`~~ — protección estructural (glob explícito) + guard, con test de regresión (`test/fixture-safety.test.js`).

## Referencia

La auditoría completa (inventario de sintaxis específica de Postgres, plan de fases DB-0 a DB-9, tabla de riesgos) está publicada como artefacto aparte — pedísela a quien tenga el link si la necesitás, no se duplica acá.
