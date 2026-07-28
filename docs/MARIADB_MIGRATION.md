# Migración PostgreSQL → MariaDB — estado y guía

**Decisión definitiva del usuario:** el motor productivo de Bitlogic Client Hub pasa a ser MariaDB/MySQL (el VPS real usa MariaDB 11.4.10 vía HestiaCP). PostgreSQL sigue siendo el motor **activo hoy** — esta migración se hace de a un dominio funcional por vez, sin apagar Postgres hasta que todos los módulos y los datos reales estén validados contra MariaDB.

**No cambiar `DATABASE_URL` a `mysql://` en ningún ambiente real todavía.** Solo el dominio auth/users tiene sus queries convertidas (ver más abajo) — el resto de los módulos (clientes, hosting, dominios, facturación, soporte, tareas, configuración, backups, scheduler) siguen escritos en sintaxis PostgreSQL y romperían contra MariaDB.

## Fases completadas

| Fase | Qué hizo | Estado |
|---|---|---|
| DB-0 / DB-1 | Rama `migration/mariadb`, instaló `mysql2` (sin sacar `pg`), reescribió `db/pool.js` como capa de compatibilidad dual-driver, `config/index.js` detecta el motor por el esquema de `DATABASE_URL`, creó `db/schema.sql` (schema MariaDB consolidado, validado contra MariaDB 10.4 real) | ✅ |
| DB-3A | Convirtió el dominio auth/users (`users`, `refresh_tokens`, `password_reset_tokens`) para funcionar contra ambos motores | ✅ |
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

**Excepción documentada:** `users.id` **conserva** `DEFAULT (UUID())` en `db/schema.sql` porque `seeds/006_client_users_seed.js` (seed **demo**, no productivo) inserta usuarios sin mandar id explícito. No se retira el default hasta actualizar ese seed — no se tocó en esta fase por estar fuera de alcance (seeds demo excluidos explícitamente).

### Collation — dependencia cruzada detectada, no resuelta en esta fase

El VPS real usa `utf8mb4_unicode_520_ci`. Se intentó aplicar esa collation únicamente a las 3 tablas de auth/users y **falló la creación del schema completo** (MariaDB real, errno 150 "Foreign key constraint is incorrectly formed"): `users.id` es referenciado por FKs de otras 4 tablas todavía no convertidas (`support_tickets`, `support_ticket_messages`, `internal_tasks`, `audit_logs`) — InnoDB exige que una FK y la columna referenciada compartan la misma collation, no solo el mismo tipo. Las 3 tablas de este dominio se quedaron en `utf8mb4_unicode_ci` (la misma del resto del schema desde la Fase DB-1). **Alinear todo el schema a `utf8mb4_unicode_520_ci` requiere hacerlo de una sola vez sobre todas las tablas**, no dominio por dominio — recomendado como paso previo a la Fase DB-3B o como parte de ella, no antes.

## Cómo probar contra ambos motores

### PostgreSQL (motor activo hoy)

```bash
cd backend
npm test
```

Usa el `DATABASE_URL` de `backend/.env` (el mismo de siempre). Sin cambios respecto a como funcionaba antes de esta migración.

### MariaDB (integración real, dominio auth/users)

Requiere una instancia MariaDB **descartable** — nunca la del VPS, nunca la productiva. Forma más simple si ya tenés XAMPP con MariaDB instalado (Windows): levantar una segunda instancia con datadir y puerto propios, para no tocar la base de XAMPP que uses en otros proyectos:

```bash
# 1. Crear un datadir nuevo (vacío) e inicializarlo
mysql_install_db.exe -d "C:\ruta\a\datadir-descartable" -D

# 2. Levantar mysqld en un puerto que no choque con nada más
mysqld.exe --no-defaults --datadir="C:\ruta\a\datadir-descartable" --port=13309 --bind-address=127.0.0.1 --skip-grant-tables

# 3. Correr los tests apuntando a esa instancia (el nombre de base en la URL no importa, cada test crea la suya)
cd backend
MARIADB_TEST_URL="mysql://root:@127.0.0.1:13309/ignorado" npm test

# 4. Al terminar, apagar y borrar el datadir descartable
mysqladmin.exe --no-defaults -h127.0.0.1 -P13309 -uroot shutdown
```

Sin `MARIADB_TEST_URL`, `test/auth-mariadb.test.js` se saltea (no falla). Ver `docs/TESTING.md` para el detalle de qué prueba exactamente y por qué necesita un motor real (no alcanza con mocks para confirmar que el driver `mysql2` funciona).

**Nunca correr el fixture (`test/fixtures/mariadb-auth-flow.mjs`) por fuera de `auth-mariadb.test.js`** — tiene un guard (`MARIADB_FIXTURE_RUN=1`) justamente para no escribir contra el `DATABASE_URL` que sea que esté ambiente si algo lo dispara suelto (ver `docs/TESTING.md`).

## Riesgos pendientes

- **Collation** no alineada al valor real del VPS (`utf8mb4_unicode_520_ci`) — ver sección de arriba.
- **Versión real del VPS (MariaDB 11.4.10) no probada directamente** — todas las pruebas de esta fase corrieron contra MariaDB 10.4.32 (la disponible localmente vía XAMPP). Las features usadas (`CREATE SEQUENCE`, `DEFAULT` con expresión, `CHECK`, `RETURNING` en INSERT/DELETE si se llegara a usar, `JSON`) están disponibles en 10.4 y deberían estarlo también en 11.4 (versión más nueva), pero no se confirmó contra la versión exacta.
- **`seeds/006_client_users_seed.js`** (demo) todavía depende de `DEFAULT (UUID())` en `users.id` — bloquea retirar ese default hasta que se actualice o se elimine.
- **Cross-dependencias de otros módulos con `users`**: `settings.controller.js` (conteo de usuarios) y `routes/onboarding.routes.js` (existencia de usuario de portal) hacen `SELECT`/`EXISTS` directo contra `users` en sintaxis Postgres — no se tocaron (pertenecen a otros módulos), pero son la evidencia de que convertir un dominio no aísla completamente sus tablas de los demás módulos hasta que todos estén convertidos.
- El mensaje de log `"PostgreSQL conectado"` en `server.js` queda fijo sin importar el driver real activo — cosmético, no funcional, pendiente de prolijidad para una fase futura.

## Referencia

La auditoría completa (inventario de sintaxis específica de Postgres, plan de fases DB-0 a DB-9, tabla de riesgos) está publicada como artefacto aparte — pedísela a quien tenga el link si la necesitás, no se duplica acá.
