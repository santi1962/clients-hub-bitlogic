# Migración PostgreSQL → MariaDB — estado y guía

**Decisión definitiva del usuario:** el motor productivo de Bitlogic Client Hub pasa a ser MariaDB/MySQL (el VPS real usa MariaDB 11.4.10 vía HestiaCP). PostgreSQL sigue siendo el motor **activo hoy** — esta migración se hace de a un dominio funcional por vez, sin apagar Postgres hasta que todos los módulos y los datos reales estén validados contra MariaDB.

**No cambiar `DATABASE_URL` a `mysql://` en ningún ambiente real todavía.** Los dominios auth/users, **clients**, **hosting_plans/hosting_services**, **`audit_logs`**, **domains**, **Support/Tickets**, **Tasks** y **Settings** (`company_settings`) tienen sus queries convertidas (ver más abajo) — el resto de los módulos (email_templates, automation real, scheduler, dashboard, facturación) siguen escritos en sintaxis PostgreSQL y romperían contra MariaDB.

## Empezá por acá (si estás retomando esto, en esta máquina o en otra)

- **Rama:** el trabajo de migración vive mergeado en `main` (el histórico `migration/mariadb` de `origin` quedó contenido enteramente dentro de `main` desde el merge `70fec99`, que además trajo hardening/security/scheduler). Trabajar directo sobre `main`.
- **Última fase cerrada:** DB-3H (dominio **Settings** convertido: `company_settings`; `automation_settings` solo revisado a nivel schema, su CRUD real queda para una fase de Automation dedicada).
- **Qué está hecho:** capa de compatibilidad dual-driver (`pg`/`mysql2`) en `backend/src/db/pool.js`, schema MariaDB consolidado y con collation normalizada (`backend/db/schema.sql`, validado contra MariaDB 11.4 real), y los dominios **auth/users**, **clients**, **hosting_plans/hosting_services**, **`audit_logs`**, **domains**, **Support/Tickets**, **Tasks** y **Settings** con sus queries convertidas y probadas contra ambos motores. El punto ciego de auditoría contra MariaDB (documentado en DB-3B/DB-3C) ya no existe para ninguno de estos.
- **Qué falta:** todo lo demás (Fase DB-3I en adelante) — email_templates, automation (real, `automation-settings.service.js`), scheduler, dashboard, y facturación/`billing` al final (es el módulo con más incompatibilidades: `UPDATE...RETURNING`, `FILTER`, `generate_series`).
- **Antes de tocar código nuevo:** correr `cd backend && npm test` (Postgres) y, si hay una MariaDB descartable a mano, `MARIADB_TEST_URL=mysql://... npm test` (ver la sección "Cómo probar contra ambos motores" más abajo) — para confirmar que se arranca desde un estado verde. **Ojo:** en un checkout nuevo, sin `backend/.env` con credenciales de un Postgres local real, 3 tests van a fallar siempre — ver "Línea base de tests" más abajo, no es una regresión.
- El resto de este documento es la referencia técnica completa (decisiones de conversión, política de UUID, collation, cómo levantar una MariaDB de prueba, riesgos). Esta sección de arriba es solo el punto de entrada rápido.

## Línea base de tests (aclarado en la Fase DB-3D)

Un reporte previo de esta migración citó "PostgreSQL: 90/98 pass, MariaDB: 93/98 pass, mismos 5 fallos preexistentes" — aritméticamente correcto pero ambiguo: no explicitaba que la diferencia entre 90 y 98 no eran todo fallos. Desglose real de aquel momento:

| Motor | tests | pass | fail | skip |
|---|---|---|---|---|
| Postgres (sin `MARIADB_TEST_URL`) | 98 | 90 | 5 | 3 |
| MariaDB (con `MARIADB_TEST_URL`) | 98 | 93 | 5 | 0 |

Los 3 tests que le faltaban a la cuenta de Postgres para llegar a 98 **no eran fallos** — eran los 3 tests de integración MariaDB (`auth-mariadb`, `clients-mariadb`, `hosting-mariadb`) saltados por `skip` al no haber `MARIADB_TEST_URL`. La Fase DB-3D investigó los 5 fallos uno por uno (nunca asumidos, siempre confirmados con logs reales o instrumentación temporal) y corrigió los que eran corregibles sin ampliar alcance:

| Test | Causa confirmada | Resolución |
|---|---|---|
| `uploads: tipo válido (imagen png) es aceptado` | `backend/uploads/tickets/` no existe en un checkout nuevo (no versionado, nadie lo creaba) — multer fallaba con `ENOENT` al escribir a disco, **no** por el `fileFilter` (confirmado instrumentando `fileFilter` con un log temporal: el mimetype siempre pasaba la validación). | **Corregido**: `ticketUpload.js` ahora crea el directorio si no existe, mismo patrón que `settings.routes.js` ya usa para `uploads/logos`. |
| `uploads: nombre malicioso...` | Misma causa exacta. | **Corregido**, mismo fix. |
| `health: /api/health/ready responde 200...` | `503` en vez de `200` — este test (a diferencia del resto de la suite, casi toda mockeada) hace una query real de `SELECT 1` contra Postgres. No hay `backend/.env` en este checkout; hay un Postgres 18 real corriendo como servicio local (puerto 5432), pero sin credenciales configuradas. | **No corregido** — dependiente del entorno, requiere credenciales reales que no están disponibles ni corresponde adivinar. |
| `health: /api/health (alias histórico)...` | Mismo endpoint, misma causa. | **No corregido**, mismo motivo. |
| `settings: PUT /company con rol super_admin...` | `500` con `"SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"` (confirmado en el log real) — este test mockea solo la query de `audit_logs`, pero deja pasar la de `settings.service.js` al pool real. Mismo root cause que los dos de arriba. | **No corregido**, mismo motivo. |

**Ninguno de los 5 era una regresión de DB-3A/DB-3B/DB-3C** — confirmado por comparación contra el estado previo a esas fases (`git stash` durante DB-3B: los mismos 5 fallos ya existían en `main` sin ninguno de los cambios de esta migración).

**Línea base actual (tras DB-3H):**

| Motor | tests | pass | fail | skip |
|---|---|---|---|---|
| Postgres | 157 | 146 | **3** | 8 |
| MariaDB | 157 | 154 | **3** | 0 |

Los 3 fallos restantes (los dos de `health` + el de `settings`) son **dependientes del entorno** (falta un `backend/.env` con credenciales reales de un Postgres local) y se consideran la línea base esperada de un checkout nuevo sin ese archivo — no bloquean ninguna fase futura de esta migración.

## Fases completadas

| Fase | Qué hizo | Estado |
|---|---|---|
| DB-0 / DB-1 | Rama `migration/mariadb`, instaló `mysql2` (sin sacar `pg`), reescribió `db/pool.js` como capa de compatibilidad dual-driver, `config/index.js` detecta el motor por el esquema de `DATABASE_URL`, creó `db/schema.sql` (schema MariaDB consolidado, validado contra MariaDB 10.4 real) | ✅ |
| DB-3A | Convirtió el dominio auth/users (`users`, `refresh_tokens`, `password_reset_tokens`) para funcionar contra ambos motores | ✅ |
| DB-2.5 | Normalizó la collation de **todo** `db/schema.sql` a `utf8mb4_unicode_520_ci` (la del VPS real), creó `backend/scripts/apply-mariadb-schema.mjs` (runner reproducible del schema), validó todo contra MariaDB **11.4.12** real (Docker, no 10.4), corrigió la idempotencia de los triggers, y blindó estructuralmente los fixtures de test | ✅ |
| DB-3B | Convirtió el dominio **clients** (única tabla dueña: `clients`) para funcionar contra ambos motores, retiró el `DEFAULT (UUID())` de `clients.id`, y documentó un patrón nuevo (no usado en DB-3A): decidir 404 por un SELECT posterior en vez de por el `rowCount` de la UPDATE — ver "UPDATE/DELETE sin RETURNING: por qué no alcanza con rowCount" más abajo | ✅ |
| DB-3C | Convirtió `hosting_plans` (`plans.service.js`, dueño real vía HTTP, y las funciones equivalentes — inalcanzables por HTTP, ver hallazgo de ruteo más abajo — de `hosting.service.js`) y `hosting_services` (`hosting.service.js`), retiró `DEFAULT (UUID())` de ambos `id`, refinó cuándo el patrón "SELECT en vez de rowCount" de DB-3B hace falta y cuándo no (`suspendService`/`reactivateService` son seguros con rowCount; `updateService`/`updatePlan`/`changeServicePlan` no) | ✅ |
| DB-3D | Convirtió el subsistema transversal **`audit_logs`** (`audit.service.js`), retiró `DEFAULT (UUID())` de `audit_logs.id`, arregló un bug preexistente de doble-parseo de JSON en `getLogById`, reemplazó el `console.error` crudo por el logger estructurado (+ `requestId`, propagado desde `clients`/`plans`/`hosting.controller.js`), y aclaró la línea base real de la suite de tests (ver arriba) — el punto ciego de auditoría contra MariaDB desapareció | ✅ |
| DB-3E | Convirtió el dominio **domains** (`domains.service.js`): reemplazó los casts `::float` de SQL por `parseFloat()` en JS, reemplazó `NOW() + (N * INTERVAL '1 day')` (Postgres-only) por una fecha de corte calculada en Node, normalizó `auto_renew` (0/1 -> boolean), y **NO retiró** el `DEFAULT (UUID())` de `domains.id` — a diferencia de las fases anteriores, `seeds/004_domains_seed.js` todavía depende de ese default (mismo caso que `users.id` en DB-3A). Encontró y documentó (sin arreglar, fuera de alcance) un bug preexistente en `domains.controller.js deleteDomain`: no chequea `null` antes de leer `domain.domain`, da 500 en vez de 404 al borrar un dominio inexistente — igual en ambos motores, no es un problema de SQL | ✅ |
| DB-3F | Convirtió **Support/Tickets** (`support_tickets` + `support_ticket_messages`, `support.service.js` + la query cruda de `portal.routes.js`): política `ticket_number` confirmada como "generación en DB en ambos motores" (ya vigente, sin cambios de código); retiró `DEFAULT (UUID())` de ambas tablas (sin bloqueos de seeds, a diferencia de `domains`); encontró y corrigió (solo del lado MariaDB, por decisión explícita) un gap de schema preexistente en ambos motores: `support_ticket_messages` no tenía `attachment_url`/`attachment_type`/`attachment_name` ni permitía `message` nulo, pese a que el código ya los usa para mensajes de solo-adjunto; confirmó que el orden transaccional de `addMessage` (BEGIN → INSERT mensaje → SELECT → UPDATE `last_message_at` → COMMIT → recién ahí Socket.IO/Telegram) ya cumplía la regla de "no emitir antes del commit", sin cambios | ✅ |
| DB-3G | Convirtió **Tasks** (`internal_tasks`, `tasks.service.js`): retiró `DEFAULT (UUID())` sin bloqueos (ningún seed lo usaba); reemplazó `ORDER BY due_date ASC NULLS LAST` (Postgres-only) por `ORDER BY (due_date IS NULL), due_date ASC` (SQL estándar, mismo resultado en ambos motores); `deleteTask` pasó a leer la fila completa con un `getTask` previo porque el `DELETE ... RETURNING *` original no tiene equivalente directo con `?` sin transacción — mismo criterio que el resto de los dominios (`rowCount` seguro para `DELETE`, `SELECT` posterior para `UPDATE`/`completeTask`/`reopenTask`) | ✅ |
| DB-3H | Convirtió **Settings** (`company_settings`, `settings.service.js`): reemplazó `uuidv4()` del paquete `uuid` por `crypto.randomUUID()`; convirtió la transacción existente de `updateCompanySettings`/`updateCompanyLogo` (BEGIN/COMMIT/ROLLBACK, sin cambios de estructura) a placeholders `?` con `SELECT` posterior en vez de `RETURNING`; agregó `company_settings.logo_url` al schema MariaDB (gap preexistente en ambos motores, mismo patrón que los adjuntos de `support_ticket_messages` en DB-3F); retiró `DEFAULT (UUID())` sin bloqueos. `automation_settings` solo se revisó a nivel schema (ya estaba correcto) — su CRUD real (`automation-settings.service.js`/`.controller.js`) queda fuera de alcance ("automation real"), para una fase dedicada | ✅ |
| DB-3I en adelante | Resto de los módulos (email_templates, automation real, scheduler, dashboard, facturación) | ⏳ pendiente |

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

### UPDATE/DELETE sin RETURNING: por qué no alcanza con `rowCount` para decidir 404 (hallazgo de la Fase DB-3B)

El patrón de DB-3A (`UPDATE ...; if (rowCount === 0) throw 404`) asume que MariaDB reporta como "afectadas" las filas que **matchearon** el `WHERE`, igual que Postgres. Eso es cierto solo si el driver habilita `CLIENT_FOUND_ROWS` — **`mysql2` no lo hace por default en este proyecto** (`db/pool.js` no pasa esa opción). Sin ella, `affectedRows` cuenta filas **realmente modificadas**: un `UPDATE` cuyo `COALESCE` no cambia ningún valor (ej. un PATCH que repite el `status` actual, o repetir un soft-delete sobre un cliente ya `inactive`) devuelve `rowCount = 0` en MariaDB aunque la fila exista y el `WHERE` haya matcheado — mientras que Postgres, en el mismo caso, sigue devolviendo `rowCount = 1`.

Esto no se detectó en DB-3A porque `resetPassword` siempre escribe `updated_at = now()`, un valor que cambia en cada llamada — enmascara el problema sin querer. `updateClient`/`softDeleteClient` (dominio `clients`) sí lo exponen, porque un cliente puede recibir un PATCH/DELETE que no cambia ningún valor real.

**Solución aplicada (sin tocar `pool.js`, infraestructura compartida fuera de alcance de este dominio):** el 404 se decide con un `SELECT` posterior que confirma existencia, nunca con el `rowCount` de la `UPDATE`. Ver `updateClient` y `softDeleteClient` en `clients.service.js`. **Este es el patrón recomendado para cualquier módulo futuro** que convierta un `UPDATE ... RETURNING`/`DELETE ... RETURNING` cuyo `WHERE` pueda matchear una fila sin cambiar ningún valor (soft-deletes idempotentes, PATCHs parciales) — `rowCount` sigue siendo válido únicamente cuando la operación garantiza un cambio real en cada llamada exitosa (como `updated_at = now()` en `resetPassword`).

### Cómo distinguir cuándo hace falta el SELECT posterior y cuándo no (refinado en la Fase DB-3C)

DB-3C convirtió 8 `UPDATE ... RETURNING`/`DELETE ... RETURNING` más (`plans.service.js` y `hosting.service.js`) y expuso la regla completa, no solo el caso general de arriba:

- **`DELETE` sin `RETURNING`**: siempre seguro con `rowCount`, en ambos motores. Un `DELETE` no tiene la ambigüedad "matched pero sin cambio de valor" — o borra la fila (`rowCount = 1`) o no la encuentra (`rowCount = 0`). Ver `deletePlan`/`deleteService`.
- **`UPDATE` con `COALESCE`** (PATCH parcial: `SET col = COALESCE(?, col)`): **nunca seguro con `rowCount`** — reenviar los mismos valores que la fila ya tiene (o un PATCH sin ese campo) no cambia nada, `rowCount = 0` en MariaDB con la fila todavía ahí. Necesita el patrón `UPDATE; SELECT`. Ver `updatePlan` (ambos archivos) y `updateService`.
- **`UPDATE` con un `SET` directo (sin `COALESCE`) pero cuyo `WHERE` no excluye el valor destino**: tampoco seguro — si el nuevo valor coincide por casualidad con el que ya tenía la fila (ej. reasignar a un cliente el mismo plan que ya tenía), tampoco hay cambio real. Ver `changeServicePlan`: reasignar el mismo `plan_id` dejaría `plan_id`/`storage_total_gb`/`emails_total`/`monthly_price` exactamente iguales.
- **`UPDATE` cuyo `WHERE` excluye explícitamente el estado destino** (ej. `WHERE status != 'suspended'` para poner `status = 'suspended'`): **sí es seguro con `rowCount`**, en ambos motores — si el `WHERE` matchea, el valor *necesariamente* cambia (el estado anterior era, por construcción, distinto del nuevo). Ver `suspendService`/`reactivateService`, que **no** se convirtieron al patrón `SELECT` posterior a propósito, y siguen usando `rowCount` tal cual DB-3A/DB-3B ya lo hacían para casos análogos.

Regla general para el próximo módulo: preguntarse "¿puede esta escritura ejecutarse exitosamente sin cambiar ningún valor de la fila?" — si la respuesta es sí (incluso en un caso de borde poco frecuente), no confiar en `rowCount` para decidir 404 contra MariaDB.

### `ILIKE`, `FILTER (WHERE ...)` y el alias de `COUNT(*)` (hallazgos de la Fase DB-3B)

Tres incompatibilidades nuevas que no habían aparecido en auth/users (ese dominio no tiene búsqueda ni agregados), encontradas al convertir `clients.service.js`:

- **`ILIKE`** no existe en MariaDB. La conversión ingenua a `LIKE` plano dependería de que la columna tenga collation case-insensitive (cierto hoy para `name`/`company`/`email` de `clients`, por ser el default de tabla `_520_ci`, pero no garantizado para siempre ni generalizable a otras columnas). Se usó en cambio `LOWER(col) LIKE LOWER(?)`, que da el mismo resultado case-insensitive en **ambos motores con una sola query**, sin depender del collation ni bifurcar por driver.
- **`FILTER (WHERE ...)`** sobre una función de agregado (`COUNT(hs.id) FILTER (WHERE ...)`, `MIN(hs.next_due_date) FILTER (WHERE ...)`) es sintaxis exclusiva de Postgres. Se reemplaza por `COUNT(CASE WHEN ... THEN hs.id END)` / `MIN(CASE WHEN ... THEN hs.next_due_date END)` — estándar SQL, funciona igual en ambos motores.
- **`SELECT COUNT(*) FROM ...` sin alias**: Postgres nombra la columna resultante `count` por default; MariaDB la nombra `COUNT(*)` literal. Cualquier código que lea `rows[0].count` (como `listClients`) recibía `undefined` contra MariaDB sin un alias explícito. Se agregó `AS count` a la query. **Cualquier `SELECT COUNT(*)` sin alias que se convierta en un módulo futuro tiene este mismo bug latente** — vale la pena revisarlos todos cuando les toque su fase (`dashboard.service.js`, `audit.service.js`, `billing.service.js`, `hosting.service.js`, etc. todavía lo tienen sin alias, pero no se tocaron por estar fuera de alcance de DB-3B).

### `audit_logs`: JSON, política de fallo, y requestId (Fase DB-3D)

- **Bug preexistente arreglado**: `getLogById` hacía `JSON.parse(rows[0].old_values)` incondicional. Bajo Postgres, `pg` ya deserializa `jsonb` a objeto JS automáticamente — `JSON.parse(unObjeto)` revienta con `SyntaxError` (`"[object Object]"` no es JSON válido). Nunca se había detectado porque no existía ningún test que ejercitara `getLogById` con `old_values`/`new_values` no nulos antes de esta fase. Se corrigió con el mismo parseo defensivo que ya usa `auth.service.js formatUser()` para `notifications` (DB-3A): `typeof value === "string" ? JSON.parse(value) : value`.
- **Política de fallo — best-effort, confirmada (no cambiada)**: `logAction` ya envolvía su `INSERT` en `try/catch` sin relanzar — una acción de negocio ya completada no fallaba con 500 solo porque el registro de auditoría no se pudo escribir. Eso se conserva tal cual. Lo que sí cambió es la **visibilidad**: antes usaba `console.error` crudo; ahora usa el logger estructurado del proyecto (`createLogger`), incluyendo `requestId` cuando el caller lo pasa. `clients.controller.js`, `plans.controller.js` y `hosting.controller.js` (los 3 dominios ya convertidos) ahora pasan `requestId: req.requestId` a `logAction` — los controllers de módulos todavía-Postgres-only (billing, support, tasks, settings, domains, automation-settings) no se tocaron, así que sus llamadas siguen sin `requestId` hasta que les toque su propia fase.
- **Nada sensible se agregó al log de error**: el objeto que se loguea ante un fallo de `INSERT` solo incluye `action`/`entityType`/`entityId`/`requestId`/el error — nunca `oldValues`/`newValues`. No se construyó ninguna sanitización nueva sobre lo que sí se persiste en la fila de `audit_logs` (`old_values`/`new_values`) — sigue siendo responsabilidad del caller no mandar secretos ahí, igual que antes de esta fase. El logger (`utils/logger.js`) ya redacta automáticamente claves como `password`/`token`/`authorization` si aparecieran en cualquier objeto que se le pase — protección preexistente, no nueva.
- **`user_id` y la FK `ON DELETE SET NULL`**: confirmado con un test real (`audit-mariadb.test.js`) que borrar el usuario que generó una acción no borra el `audit_log` — solo pone `user_id` en `NULL`, conservando `user_name`/`user_role` (que ya se copiaban al momento de la acción, no se leen por join).
- **Hallazgo de entorno, no de código**: al validar la política UTC (`created_at`) contra la MariaDB descartable de esta fase, la instancia inicial (mysqld portable de XAMPP, sin flags de timezone) tenía `@@global.time_zone = SYSTEM`, y el sistema operativo de esta máquina está en UTC-3 — `CURRENT_TIMESTAMP` se insertaba con un offset de 3 horas respecto a UTC real. No es un bug de `audit.service.js` ni de `pool.js` (que sigue forzando `timezone: "Z"` del lado del driver, como ya hacía desde DB-1) — es una omisión en el comando de la Opción B de este documento (a diferencia del ejemplo Docker de la Opción A, que sí pasa `--default-time-zone=+00:00`). Se corrigió reiniciando la instancia descartable con ese mismo flag. **Actualizado el comando de la Opción B más abajo** para incluirlo — cualquier instancia de MariaDB descartable levantada para probar esta migración debería forzar UTC, sea Docker o portable.

### `domains`: casts, INTERVAL, BOOLEAN y un bug de controller encontrado (Fase DB-3E)

- **`annual_cost::float`/`customer_price::float`** (casts en SQL, exclusivos de Postgres): a diferencia de `clients`/`hosting_plans` (que ya usaban `parseFloat()` en JS antes de esta migración), `domains.service.js` hacía el cast en la propia query. Se movió a `parseFloat()` en `formatDomain()`, mismo criterio que el resto de los dominios — MariaDB devuelve `DECIMAL` como string sin cast explícito.
- **`NOW() + ($N * INTERVAL '1 day')`** (filtro `expiringInDays`): sintaxis Postgres, sin forma de parametrizar un `INTERVAL` equivalente en MariaDB sin bifurcar por driver. Se resolvió calculando la fecha de corte **en Node** (`new Date(Date.now() + dias*86400000)`) y pasándola como parámetro simple — una comparación `DATE <= timestamp` (con cast implícito de la columna `DATE` a medianoche) funciona igual en ambos motores, sin ninguna sintaxis específica de ninguno. Mismo principio que ya se usó para el filtro `expiringInDays` — no se creó ningún conversor SQL genérico.
- **`auto_renew` (BOOLEAN)**: `pg` devuelve un boolean nativo (`true`/`false`); `mysql2` devuelve `0`/`1` (MariaDB `BOOLEAN` es alias de `TINYINT(1)`). `formatDomain()` ahora normaliza con `!!row.auto_renew` — mismo shape observable (`true`/`false`) en ambos motores.
- **`domain` no se normaliza a minúsculas en JS** (a diferencia de `clients.email`) — la case-insensibilidad de `UNIQUE(domain)` depende pura y exclusivamente del collation: en Postgres (`domain text unique`, case-sensitive por default) dos dominios con distinto case **no** colisionan; en MariaDB (collation de tabla `_520_ci`, case-insensitive) sí colisionan. Confirmado con un test real (`domains-mariadb.test.js`) — es la misma divergencia ya aceptada desde DB-2.5 para `hosting_services.domain`, extendida acá sin cambiar nada nuevo.
- **Bug de controller encontrado, no arreglado (fuera de alcance — no es de SQL/motor)**: `domains.controller.js deleteDomain` no chequea que `getDomainById` haya devuelto `null` antes de leer `domain.domain` para la auditoría — borrar un dominio inexistente revienta con `TypeError: Cannot read properties of null (reading 'domain')` → 500, en vez del 404 esperado. Ocurre idéntico en Postgres y MariaDB (es un bug de la capa de controller, nunca tocado por esta migración de motor) — documentado y con un test que confirma el comportamiento real, no "arreglado" para no ampliar el alcance de esta fase ni cambiar el contrato observable sin que lo pida una fase dedicada a `domains` como feature.

### Support/Tickets: ticket_number, gap de schema de adjuntos, y transacción de mensajes (Fase DB-3F)

- **`ticket_number` — política A confirmada (generación en DB, ambos motores)**: Postgres usa `DEFAULT generate_ticket_number()` (función PL/pgSQL + secuencia); MariaDB usa el trigger `trg_support_tickets_number` + `support_ticket_number_seq` (ya existente desde DB-1/DB-2.5). Mismo formato exacto (`TK-{YYYY}-{NNNN}`), mismo mecanismo anti-duplicados (`NEXTVAL` de secuencia, atómico en ambos motores, sin `MAX()+1`). `support.service.js createTicket` **nunca** envía `ticket_number` en el INSERT en ninguno de los dos motores — política ya vigente antes de esta fase, confirmada y no tocada. Verificado con un test real que crea 2 tickets seguidos y confirma que el segundo `ticket_number` no repite al primero.
- **Gap de schema preexistente, encontrado en esta fase**: ni `db/schema.sql` (MariaDB) ni `migrations/005_support_schema.sql` (Postgres, sin migración posterior que lo corrija) declaraban `attachment_url`/`attachment_type`/`attachment_name` en `support_ticket_messages`, y `message` era `NOT NULL` — pese a que `support.service.js`/`support.controller.js`/`portal.routes.js` ya insertan esas 3 columnas y permiten `message: null` para un mensaje de solo-adjunto. Es decir: un mensaje de ticket sin texto (solo con archivo) ya rompería contra el schema tal cual estaba versionado en el repo, en **cualquiera** de los dos motores. Por decisión explícita del usuario, se corrigió **únicamente el lado MariaDB** (`db/schema.sql`): se agregaron las 3 columnas y se relajó `message` a nullable. **No se tocaron las migraciones de Postgres** (fuente de verdad mientras sea el motor activo) — se asume que el Postgres real del VPS ya tiene estas columnas por un `ALTER TABLE` no versionado (el módulo está documentado como "funcional y probado con datos reales" en `docs/PRODUCTION_STATUS.md`, lo que sería imposible si los adjuntos estuvieran realmente rotos en producción). Si eso resulta no ser cierto, hace falta una migración de Postgres dedicada — fuera del alcance de esta fase.
- **Transacción de `addMessage`**: ya usaba `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` antes de esta fase (única transacción real del dominio) — se convirtió a placeholders `?` sin cambiar su estructura. Confirmado que Socket.IO (`getIo()?.to(...).emit(...)`) y el aviso de Telegram se emiten **después** del `COMMIT`, nunca antes, y que un error en cualquier paso de la transacción hace `ROLLBACK` sin llegar a emitir nada — cumple la regla pedida de no emitir efectos externos antes de persistir.
- **`updateTicket`/`assignTicket`/`resolveTicket`/`closeTicket`**: convertidos al patrón `UPDATE + SELECT` (decidiendo 404 por el SELECT, no por `rowCount`) — mismo criterio que el resto de los dominios, porque un `PATCH`/reasignación que repite el mismo valor puede no cambiar nada y dar `rowCount=0` en MariaDB. `deleteTicket` (hard delete real, cascada de mensajes por FK) sigue usando `rowCount` sin cambios — un `DELETE` no tiene esa ambigüedad.
- **Ownership del portal**: sin cambios de comportamiento — `portal.routes.js` sigue comparando `ticket.client_id !== req.user.clientId` en JS después de traer el ticket completo (no a nivel SQL), y sigue filtrando mensajes internos (`!m.is_internal`) del lado de la aplicación, no de la query. Confirmado con un test real que un cliente no puede ver un ticket ajeno (403) ni sus mensajes internos.
- **Bug preexistente encontrado, no arreglado (fuera del criterio de la Fase 14 — no afecta códigos 404/403/409)**: `support.controller.js` usa `ticket.ticketNumber`/`oldTicket.ticketNumber` (camelCase) para `entityName` en los `logAction` de crear/resolver/cerrar, pero el service devuelve filas crudas de la DB (`ticket_number`, snake_case, sin formatter) — `entityName` siempre queda `undefined` en esos 3 audit logs. No afecta ningún status code HTTP, solo la calidad del dato de auditoría — documentado, no corregido para no ampliar el alcance de esta fase.
- **Sin validación de ownership de `hosting_service_id`** en `createTicket` (puede crearse un ticket para un cliente A referenciando un servicio de un cliente B) y **sin restricción de máquina de estados** (cualquier `status` dentro del `CHECK` es una transición válida, sin importar el estado previo) — comportamiento preexistente, confirmado con tests, no se inventaron reglas nuevas.
- **No existe un endpoint de "reabrir" un ticket** — documentado como ausencia real, no se agregó ninguno.

### Tasks: `NULLS LAST` y `DELETE ... RETURNING *` sin transacción (Fase DB-3G)

- **`ORDER BY due_date ASC NULLS LAST`**: sintaxis exclusiva de Postgres — MariaDB ordena `NULL` primero en `ASC` por default, sin cláusula `NULLS LAST`. Se reemplazó por `ORDER BY (t.due_date IS NULL), t.due_date ASC, ...`: la expresión booleana `(x IS NULL)` vale `0`/`false` para no-nulos y `1`/`true` para nulos en **ambos** motores — ordenar ascendente por esa expresión primero pone los no-nulos antes que los nulos, exactamente el efecto de `NULLS LAST`, con SQL estándar y sin bifurcar por driver.
- **`deleteTask` con `DELETE ... RETURNING *`**: a diferencia de `deleteTicket`/`softDeleteClient`/etc. (que solo necesitaban devolver el `id`, ya conocido de antemano), acá el endpoint necesita devolver la **fila completa** que existía antes de borrarla. Sin `RETURNING`, la única forma de tener esos datos es leerlos **antes** del `DELETE` — se agregó un `getTask(id)` previo (que ya lanza 404 si no existe) y se guarda su resultado para devolverlo después del `DELETE` exitoso. No se usó una transacción explícita (`BEGIN`/`COMMIT`) porque no hay ninguna invariante que proteger entre el `SELECT` y el `DELETE` — si la tarea se borra en el medio (carrera con otra request), el `DELETE` simplemente afecta 0 filas y se tira 404, comportamiento aceptable y ya consistente con el resto de los dominios.
- **Auditoría de `deleteTask` sigue diciendo "cancelar" para un hard delete** — bug preexistente encontrado (`tasks.controller.js`: `action: "cancelar"`, `newValues: { status: "cancelled" }`, pero la tarea se borra de verdad de la base, no queda en estado `cancelled`). No afecta ningún código HTTP (404/403/409), solo la exactitud del dato de auditoría — documentado, no corregido en esta fase (no encaja en el criterio explícito de bugs corregibles).
- **Sin cross-dependencias nuevas de `internal_tasks` hacia otros dominios ya convertidos** más allá de los JOIN ya existentes (`clients`, `hosting_services`, `domains`, `support_tickets`, `users`) — todos esos dominios ya estaban convertidos antes de esta fase, así que no hubo ninguna sorpresa de compatibilidad en los JOINs.

### Settings: gap de `logo_url`, alcance de `automation_settings`, y un bug preexistente conservado a propósito (Fase DB-3H)

- **Gap de schema preexistente, mismo patrón que DB-3F**: ni `db/schema.sql` (MariaDB) ni `migrations/012_settings_schema.sql` (Postgres, sin migración posterior que lo corrija) declaraban `company_settings.logo_url`, pese a que `settings.service.js updateCompanyLogo`/`mapSettings` ya lo usan. Subir un logo de empresa ya rompería contra el schema tal cual estaba versionado, en cualquiera de los dos motores. Se corrigió **únicamente el lado MariaDB** (agregar la columna) — no se tocan migraciones de Postgres, mismo criterio ya aplicado en DB-3F.
- **`automation_settings` — alcance deliberadamente acotado**: el objetivo de esta fase lista la tabla como "incluida" (para la revisión de schema, sección 7 del pedido), pero excluye explícitamente "automation real". Su CRUD vive enteramente en `automation-settings.service.js`/`automation-settings.controller.js` — archivos separados de `settings.service.js`/`settings.controller.js`, ligados al scheduler/jobs (`payment-reminders.job.js`, `scheduler-init.service.js`). No se tocó ninguna de sus queries en esta fase — solo se confirmó que el schema de la tabla ya está correcto desde DB-1/DB-2.5 (JSON, `UNIQUE(key)` con collation `utf8mb4_bin`, `INSERT IGNORE` de los 8 defaults).
- **Bug preexistente encontrado, conservado a propósito (no "corregido" inventando un valor)**: `updateCompanyLogo` inserta `(id, logo_url)` sin `company_name`, que es `NOT NULL` en el schema. Si se sube un logo **antes** de haber guardado la configuración de empresa una sola vez, el `INSERT` revienta por violar el `NOT NULL` — en los dos motores por igual. Es un bug preexistente real (ya estaba así contra Postgres antes de esta fase), pero "arreglarlo" requeriría inventar un valor de `company_name` por default, lo cual el usuario no pidió — se documenta y se preserva el comportamiento idéntico entre motores, que es lo que esta migración de motor efectivamente audita.
- **Billing/Hosting/Payments settings son stubs sin persistencia real** (confirmado leyendo el código, no solo documentación) — no hay ninguna query que convertir ahí, y no se agregó persistencia nueva que nadie pidió.
- **Readiness** (`getReadinessStatus`): sus 6 queries (`SELECT COUNT(*) as cnt ...`) ya tenían alias explícito y no usaban placeholders — resultaron ser 100% portables sin ningún cambio de sintaxis, confirmado con un test real contra MariaDB.

### Hallazgo de ruteo (no es de MariaDB, pero afecta qué se convirtió en DB-3C): dos implementaciones paralelas de Plan CRUD

`app.js` monta `app.use("/api/hosting/plans", plansRoutes)` **antes** que `app.use("/api/hosting", hostingRoutes)`. Como Express despacha por orden de registro, **todo el tráfico HTTP a `/api/hosting/plans*` lo resuelve `plansRoutes` (`plans.service.js`)** — las rutas `GET/POST/PATCH /plans` que también define `hosting.routes.js` (montadas sobre `hosting.service.js`) quedan **inalcanzables por HTTP**, aunque el código sigue vivo (`hosting.service.js` usa su propio `getPlanById` internamente en `changeServicePlan`, y hace lookups directos a `hosting_plans` en `createService`). No es un bug introducido por esta migración — ya existía antes de DB-3C — y **no se corrigió** acá (cambiar el orden de montaje de rutas es una decisión de la app, fuera del alcance de una migración de motor de base de datos). Se convirtieron igual las queries de ambos archivos, porque ambos tocan `hosting_plans`/`hosting_services`. Si se decide arreglar el ruteo en una fase futura, revisar qué implementación (`plans.service.js` vs las funciones de plan de `hosting.service.js`) debe quedar como la única fuente de verdad — hoy difieren levemente (`plans.service.js` valida `containsPlaceholder`/precio>0 a nivel controller, `hosting.service.js` no).

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
| `clients` | No (retirado en DB-3B) | — | — |
| `hosting_plans`, `hosting_services` | No (retirado en DB-3C) | — | — |
| `audit_logs` | No (retirado en DB-3D) | — | — |
| `domains` | **Sí** — `seeds/004_domains_seed.js` (demo) inserta sin id explícito | Actualizar/eliminar ese seed demo | Sin fecha — no bloquea producción (mismo criterio que `users`, los seeds demo no corren contra la base real) |
| `support_tickets`, `support_ticket_messages` | No (retirado en DB-3F) | — | — |
| `internal_tasks` | No (retirado en DB-3G) | — | — |
| `company_settings` | No (retirado en DB-3H) | — | — |
| `automation_settings` | Sí — sin tocar en esta fase (fuera de alcance, "automation real") | Módulo Automation | Fase dedicada a Automation |
| `payment_notices`, `payments`, `payment_reminder_logs` | Sí | Módulo Facturación/Cobranza | Última (la más densa en incompatibilidades, ver recomendación de la Fase DB-3A) |
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

**Re-validado en la Fase DB-3B** (retiro del `DEFAULT (UUID())` de `clients.id`): `apply-mariadb-schema.mjs` corrido dos veces seguidas contra una MariaDB descartable confirma que el schema completo sigue siendo idempotente con ese cambio, y `SHOW CREATE TABLE clients` confirma que la columna `id` queda sin ningún `DEFAULT`. Esta vez la instancia descartable fue MariaDB **10.4** (mysqld portable de XAMPP, datadir y puerto propios — Opción B de este documento, no Docker) porque Docker Desktop no llegó a levantar el daemon en esta sesión; sigue pendiente repetir la validación contra 11.x cuando Docker esté disponible, aunque el cambio de esta fase (retirar un `DEFAULT`) no depende de ninguna feature específica de versión.

**Re-validado otra vez en la Fase DB-3C** (retiro del `DEFAULT (UUID())` de `hosting_plans.id` y `hosting_services.id`): mismo procedimiento — `apply-mariadb-schema.mjs` corrido dos veces seguidas, idempotente, `SHOW CREATE TABLE hosting_plans`/`hosting_services` confirman ambas columnas `id` sin `DEFAULT`, FKs (`hosting_services_client_id_fkey`, `hosting_services_plan_id_fkey`) y `UNIQUE (domain)` intactos. Otra vez contra MariaDB 10.4 (XAMPP) — Docker Desktop siguió sin levantar el daemon en esta sesión tampoco (mismo error 500 de la API interna, ver historial de esta fase). Pendiente repetir contra 11.x cuando Docker esté disponible.

**Re-validado una tercera vez en la Fase DB-3D** (retiro del `DEFAULT (UUID())` de `audit_logs.id`): mismo procedimiento — idempotente, `SHOW CREATE TABLE audit_logs` confirma la columna `id` sin `DEFAULT`, FK `audit_logs_user_id_fkey ... ON DELETE SET NULL` intacta, columnas `old_values`/`new_values` siguen con su `CHECK (json_valid(...))` autogenerado. Otra vez MariaDB 10.4 (XAMPP) — Docker Desktop devolvió el mismo error 500 interno una tercera vez en esta sesión, ahora contra la API `v1.55` (confirma que es un problema persistente de esta máquina, no transitorio entre reinicios de Docker Desktop). Esta fase además detectó y corrigió que la instancia descartable no estaba en UTC (ver "Hallazgo de entorno" arriba) — sin eso, la prueba de política UTC de `audit_logs.created_at` daba falso negativo.

**Re-validado una cuarta vez en la Fase DB-3E** — esta vez SIN cambios de schema que retirar (`domains.id` conserva su `DEFAULT (UUID())` a propósito, ver política UUID arriba): `apply-mariadb-schema.mjs` corrido dos veces seguidas, idempotente, `SHOW CREATE TABLE domains` confirma FKs (`domains_client_id_fkey ... ON DELETE CASCADE`, `domains_service_id_fkey ... ON DELETE SET NULL`), `UNIQUE(domain)`, `CHECK` de status y `DECIMAL(12,2)` intactos tal cual venían desde DB-1/DB-2.5 — no hizo falta ningún cambio de schema para esta fase, solo de `domains.service.js`. Docker Desktop siguió sin levantar el daemon (cuarta vez en esta sesión), MariaDB 10.4 (XAMPP, `--default-time-zone=+00:00`) de nuevo como motor descartable.

**Re-validado una quinta vez en la Fase DB-3F** (retiro del `DEFAULT (UUID())` de `support_tickets.id`/`support_ticket_messages.id`, más el agregado de columnas de adjunto y `message` nullable): `apply-mariadb-schema.mjs` corrido dos veces seguidas, idempotente. Esta vez, además de la validación habitual, se probó el **trigger real `trg_support_tickets_number`** insertando un ticket de prueba y confirmando el formato `TK-2026-0001` generado — el primer trigger de este proyecto que se ejercita de punta a punta contra una base recién aplicada con el runner oficial (los triggers anteriores, `enforce_single_company_settings`, todavía no se habían probado así). Docker Desktop siguió sin levantar el daemon (quinta vez en esta sesión, mismo error 500 interno), MariaDB 10.4 (XAMPP, `--default-time-zone=+00:00`).

**Re-validado una sexta vez en la Fase DB-3G** (retiro del `DEFAULT (UUID())` de `internal_tasks.id`): `apply-mariadb-schema.mjs` corrido dos veces seguidas, idempotente, `SHOW CREATE TABLE internal_tasks` confirma la columna `id` sin `DEFAULT` y las 6 FKs (`assigned_to`/`created_by`/`client_id`/`hosting_service_id`/`domain_id`/`support_ticket_id`, todas `ON DELETE SET NULL`) intactas. Docker Desktop esta vez ni siquiera llegó a exponer el error 500 interno — directamente no encontró el pipe del daemon (`dockerDesktopLinuxEngine`), señal de que el servicio no estaba corriendo en absoluto en esta sesión (sexta vez sin Docker disponible). MariaDB 10.4 (XAMPP, `--default-time-zone=+00:00`) de nuevo como motor descartable.

**Re-validado una séptima vez en la Fase DB-3H** (retiro del `DEFAULT (UUID())` de `company_settings.id`, agregado de `logo_url`): `apply-mariadb-schema.mjs` corrido dos veces seguidas, idempotente. Se probó además el **trigger real `trg_company_settings_single_row`**: un segundo `INSERT` sobre `company_settings` con la fila ya cargada fue rechazado con `ERROR 1644 (45000): Solo se permite una configuracion de empresa` — mismo mensaje exacto que produce la función equivalente de Postgres. Docker Desktop otra vez sin encontrar el pipe del daemon (séptima vez sin Docker disponible en esta sesión). MariaDB 10.4 (XAMPP, `--default-time-zone=+00:00`).

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
mysqld.exe --no-defaults --datadir="C:\ruta\a\datadir-descartable" --port=13309 --bind-address=127.0.0.1 --skip-grant-tables --default-time-zone=+00:00

cd backend
MARIADB_TEST_URL="mysql://root:@127.0.0.1:13309/ignorado" npm test

mysqladmin.exe --no-defaults -h127.0.0.1 -P13309 -uroot shutdown
```

**`--default-time-zone=+00:00` es obligatorio, agregado en la Fase DB-3D** — sin él, `mysqld` usa `SYSTEM` (la zona horaria del sistema operativo), y si esa zona no es UTC, `CURRENT_TIMESTAMP` (usado por `created_at`/`updated_at` en todas las tablas) se inserta con el offset local en vez de UTC — rompe cualquier test que verifique la política UTC del proyecto de forma absoluta (no solo relativa). Verificar con `SELECT NOW(), UTC_TIMESTAMP(), @@global.time_zone;` antes de correr tests sensibles a fecha.

Nota: la Opción B solo tiene la versión de MariaDB que traiga el XAMPP instalado (10.4 en esta máquina) — sirve para pruebas de queries/lógica, pero para validar el `schema.sql` en sí (collation, features específicas de 11.x) usar la Opción A.

Sin `MARIADB_TEST_URL`, `test/auth-mariadb.test.js` se saltea (no falla). Ver `docs/TESTING.md` para el detalle de qué prueba exactamente y por qué necesita un motor real (no alcanza con mocks para confirmar que el driver `mysql2` funciona).

**Nunca correr un fixture con escrituras (ej. `test/fixtures/mariadb-auth-flow.mjs`) por fuera de su test orquestador** — desde la Fase DB-2.5 hay dos protecciones independientes, ver `docs/TESTING.md`: `npm test` usa un glob explícito que nunca incluye `test/fixtures/` ni `test/helpers/`, y el fixture además tiene un guard propio (`MARIADB_FIXTURE_RUN=1`) por si se invoca directo.

## Riesgos pendientes

- **`seeds/006_client_users_seed.js`** (demo) todavía depende de `DEFAULT (UUID())` en `users.id` — bloquea retirar ese default hasta que se actualice o se elimine (ver tabla de política UUID arriba).
- **Cross-dependencias de otros módulos con `users`**: `settings.controller.js` (conteo de usuarios) y `routes/onboarding.routes.js` (existencia de usuario de portal) hacen `SELECT`/`EXISTS` directo contra `users` en sintaxis Postgres — no se tocaron (pertenecen a otros módulos), pero son la evidencia de que convertir un dominio no aísla completamente sus tablas de los demás módulos hasta que todos estén convertidos.
- **Cross-dependencias de otros módulos con `clients`** (nuevo en DB-3B, mismo patrón que el punto anterior): `dashboard.service.js`, `billing.service.js`, `email.service.js`, `domains.service.js`, `hosting.service.js`, `support.service.js`, `tasks.service.js`, `users.service.js`, `settings.controller.js`, `app.js`, `onboarding.routes.js`, `mercadopago.routes.js`, `payment-reminders.job.js` y varios scripts hacen `JOIN`/`SELECT` contra `clients` en sintaxis Postgres — no se tocaron, fuera de alcance de esta fase.
- **Cross-dependencias de otros módulos con `hosting_plans`/`hosting_services`** (nuevo en DB-3C, mismo patrón): `dashboard.service.js`, `billing.service.js`, `domains.service.js`, `support.service.js`, `tasks.service.js`, `email.service.js`, `settings.controller.js`, `mercadopago.routes.js`, `onboarding.routes.js`, `hestia-sync.job.js`, `delinquency-detection.job.js` — no se tocaron.
- ~~`audit.service.js` (`logAction`) sigue en sintaxis Postgres~~ — **resuelto en la Fase DB-3D**. Ver la sección dedicada más arriba.
- **Cross-dependencias de otros módulos con `audit_logs`** (mismo patrón que `clients`/`hosting_plans`/`hosting_services`): `automation-settings.controller.js`, `billing.controller.js`, `settings.controller.js`, `support.controller.js`, `tasks.controller.js` llaman a `auditService.logAction(...)` — no se tocaron esos controllers (siguen sin pasar `requestId`), pero la conversión de `audit.service.js` los beneficia igual. `domains.controller.js` ahora sí pasa `requestId` (dominio convertido en DB-3E).
- **Cross-dependencias de otros módulos con `domains`** (mismo patrón que `clients`/`hosting_plans`/`hosting_services`): `dashboard.service.js`, `app.js` (healthcheck), `settings.controller.js`, `onboarding.routes.js`, `tasks.service.js`, `email.service.js` (`sendDomainReminderEmail`) hacen `SELECT`/`JOIN` directo contra `domains` en sintaxis Postgres — no se tocaron.
- **`seeds/004_domains_seed.js`** (demo) todavía depende de `DEFAULT (UUID())` en `domains.id` — bloquea retirar ese default hasta que se actualice o se elimine (ver tabla de política UUID arriba).
- **Bug preexistente sin arreglar**: `domains.controller.js deleteDomain` da 500 (no 404) al borrar un dominio inexistente — ver sección dedicada arriba. No es específico de MariaDB ni introducido por esta migración.
- **`domains.domain` no tiene normalización a minúsculas en JS** y colisiona (o no) según el collation de cada motor — ver sección dedicada arriba, mismo criterio ya aceptado para `hosting_services.domain` desde DB-2.5.
- **Cross-dependencias de otros módulos con `support_tickets`/`support_ticket_messages`** (mismo patrón que fases anteriores): `tasks.service.js` (JOIN por `support_ticket_id`), `email.service.js` (`sendTicketReplyEmail`), `internal_tasks`/`email_logs` (FKs hacia `support_tickets`) — no se tocaron.
- **Gap de schema de adjuntos resuelto solo del lado MariaDB** (ver sección dedicada arriba) — el lado Postgres (`migrations/005_support_schema.sql`) sigue sin las 3 columnas de adjunto ni `message` nullable en el repo. Si el Postgres real del VPS no las tiene tampoco (no se pudo verificar, sin credenciales), los mensajes de solo-adjunto están rotos en producción hoy — independiente de esta migración a MariaDB.
- **Bug preexistente sin arreglar (no afecta códigos HTTP)**: `entityName` queda `undefined` en los `logAction` de crear/resolver/cerrar un ticket, por un mismatch camelCase/snake_case en `support.controller.js` — ver sección dedicada arriba.
- **Sin validación de ownership de `hosting_service_id`** al crear un ticket, y **sin restricción de transición de estados** — comportamiento preexistente, documentado, no corregido (no se pidió en esta fase y cambiaría reglas de negocio).
- **Cross-dependencias de otros módulos con `internal_tasks`** (mismo patrón que fases anteriores): `dashboard.service.js` (3 queries: contadores, tareas vencidas, listado próximo), `app.js` (healthcheck) — no se tocaron.
- **Bug preexistente sin arreglar (no afecta códigos HTTP)**: la auditoría de `deleteTask` registra `action: "cancelar"`/`status: "cancelled"` para lo que en realidad es un hard delete real — ver sección dedicada arriba.
- **Bug preexistente sin arreglar**: `updateCompanyLogo` puede romper con violación de `NOT NULL` (`company_name`) si se sube un logo antes de guardar la configuración de empresa una sola vez — ver sección dedicada arriba. Igual en ambos motores, no introducido por esta migración.
- **`automation_settings` sigue 100% Postgres-only** en su capa de aplicación (`automation-settings.service.js`/`.controller.js`) — solo su schema fue confirmado como ya compatible. Cambiar `DATABASE_URL` a `mysql://` seguiría rompiendo ese módulo.
- **Cross-dependencias de `company_settings`/`automation_settings` con otros módulos** (mismo patrón que fases anteriores): `email.service.js`/`hestia.service.js` no las tocan (leen de `config`/env, no de estas tablas); `automation-settings.controller.js` y los jobs de scheduler siguen sin convertir.
- **Ruteo:** las funciones de Plan CRUD de `hosting.service.js` (`listPlans`, `createPlan`, `updatePlan`) quedaron inalcanzables por HTTP desde antes de esta fase (ver "Hallazgo de ruteo" más arriba) — se convirtieron igual porque tocan `hosting_plans`, pero no se corrigió el ruteo, fuera de alcance.
- **Sin manejo especial de violaciones de FK** en `deletePlan` (plan con servicios asociados) ni en `createService` (client_id/plan_id inexistente por fuera del chequeo de negocio de `planId`, o `domain` duplicado): hoy dan un `500` genérico en Postgres (`errorHandler.js` no distingue el código `23503`/`23505`), y lo mismo en MariaDB (`ER_ROW_IS_REFERENCED_2`/`ER_DUP_ENTRY`, sin mapear a un status HTTP más específico en este flujo). Confirmado como comportamiento preexistente, igual en ambos motores (`hosting-mariadb.test.js`) — no se agregó un `409`/`400` más prolijo, cambiaría el contrato de la API.
- El mensaje de log `"PostgreSQL conectado"` en `server.js` queda fijo sin importar el driver real activo — cosmético, no funcional, pendiente de prolijidad para una fase futura.
- El resto de las tablas (todo lo que no sea auth/users/clients/hosting_plans/hosting_services) tiene la collation ya alineada al VPS desde la Fase DB-2.5, pero sus queries de aplicación siguen sin convertir — cambiar `DATABASE_URL` a `mysql://` en cualquier ambiente real sigue rompiendo esos módulos.
- **`clients.email` no tiene `UNIQUE`** (a diferencia de `users.email`) — dos clientes pueden compartir el mismo email hoy, en ambos motores. Documentado como comportamiento existente confirmado durante DB-3B (`clients-mariadb.test.js`), no como bug introducido por la migración.
- **`hosting_plans.name` tampoco tiene `UNIQUE`** — mismo caso que `clients.email`, confirmado durante DB-3C (`hosting-mariadb.test.js`): dos planes pueden llamarse igual. `hosting_services.domain` sí es `UNIQUE` (preexistente, sin cambios).

## Resueltos en esta fase (ya no son riesgo)

- ~~Collation no alineada al VPS~~ — normalizada globalmente a `utf8mb4_unicode_520_ci`.
- ~~Versión real del VPS no probada~~ — validado contra MariaDB 11.4.12 real (Docker), no solo 10.4.
- ~~Triggers no idempotentes~~ — corregido con `DROP TRIGGER IF EXISTS`.
- ~~Fixtures con escrituras podían auto-ejecutarse por descubrimiento de `node --test`~~ — protección estructural (glob explícito) + guard, con test de regresión (`test/fixture-safety.test.js`).

## Referencia

La auditoría completa (inventario de sintaxis específica de Postgres, plan de fases DB-0 a DB-9, tabla de riesgos) está publicada como artefacto aparte — pedísela a quien tenga el link si la necesitás, no se duplica acá.
