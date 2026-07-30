# Tests del backend

## Cómo correrlos

```bash
cd backend
npm test
```

o desde la raíz del repo:

```bash
npm run test:backend
```

Ambos ejecutan `node --test "test/**/*.test.js"` (glob explícito desde la Fase DB-2.5, ver más abajo por qué), el test runner nativo de Node (no se instaló Jest, Vitest, Mocha ni ningún otro framework — Node 22, ya instalado, lo trae de fábrica). Requiere Node 18.19+ (con warning experimental) o Node 20+ (estable). No hace falta ninguna variable de entorno especial para la suite normal: los tests no dependen de credenciales reales de ninguna integración externa. La única excepción es `MARIADB_TEST_URL` (opcional, ver más abajo), usada solo por la prueba de integración MariaDB del dominio auth/users.

`npm test` **no manda tráfico real**: no envía emails, no dispara WhatsApp/Telegram, no llama a MercadoPago ni a HestiaCP, y no requiere ningún token de producción. La única excepción es una consulta real de solo lectura (`SELECT 1`) contra la base de datos local configurada en `backend/.env` — la misma que ya hace `/api/health/ready` en operación normal — usada para probar que ese endpoint funciona con una base real disponible.

## Estructura

```
backend/test/
├── config.test.js                  # Validación de config/index.js (producción, integraciones opcionales, secretos)
├── health.test.js                  # /api/health/live y /api/health/ready
├── auth.test.js                    # authRequired: token ausente/inválido/usuario inactivo/válido + rutas protegidas
├── portal-authorization.test.js    # Un cliente no puede ver recursos de otro client_id
├── mercadopago-webhook.test.js     # Verificación de firma x-signature (válida/ausente/inválida/vencida)
├── settings-plans-authorization.test.js  # Roles reales por endpoint en Configuración y Planes, y que el portal no se vio afectado
├── scheduler.test.js               # Registro de jobs, lock anti-duplicados, manejo de errores
├── uploads.test.js                 # Política de adjuntos: tipo, tamaño, nombre de archivo
├── auth-users-domain.test.js       # Fase DB-3A: UUID v4 generado en la app, transacción de resetPassword (rollback si no existe), delete sin RETURNING
├── auth-mariadb.test.js            # Fase DB-3A: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── clients-domain.test.js          # Fase DB-3B: UUID v4 generado en la app, UPDATE/DELETE+SELECT en vez de RETURNING (decidiendo 404 por SELECT, no por rowCount), placeholders `?` del WHERE dinámico de listClients
├── clients-mariadb.test.js         # Fase DB-3B: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── hosting-plans-domain.test.js    # Fase DB-3C: UUID v4, UPDATE/DELETE+SELECT vs. rowCount (cuándo cada uno es seguro, ver docs/MARIADB_MIGRATION.md), placeholders `?` de listServices/listPlans
├── hosting-mariadb.test.js         # Fase DB-3C: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── audit-domain.test.js            # Fase DB-3D: UUID v4, política best-effort + logger estructurado con requestId, fix del doble-parseo de JSON en getLogById, placeholders `?` de listLogs
├── audit-mariadb.test.js           # Fase DB-3D: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── domains-domain.test.js          # Fase DB-3E: UUID v4, ::float -> parseFloat(), BOOLEAN 0/1 -> true/false, fecha de corte de expiringInDays calculada en Node (sin INTERVAL de Postgres)
├── domains-mariadb.test.js         # Fase DB-3E: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── support-domain.test.js          # Fase DB-3F: UUID v4, UPDATE+SELECT vs. rowCount, transacción de addMessage (BEGIN/INSERT/SELECT/UPDATE/COMMIT), ROLLBACK sin emitir Socket.IO
├── support-mariadb.test.js         # Fase DB-3F: integración REAL contra MariaDB, aplica el schema.sql COMPLETO (no un subconjunto) para ejercitar el trigger real de ticket_number (opcional, ver MARIADB_TEST_URL abajo)
├── tasks-domain.test.js            # Fase DB-3G: UUID v4, UPDATE+SELECT vs. rowCount, ORDER BY (due_date IS NULL) en vez de NULLS LAST, deleteTask leyendo la fila antes de borrarla
├── tasks-mariadb.test.js           # Fase DB-3G: integración REAL contra MariaDB (opcional, ver MARIADB_TEST_URL abajo)
├── settings-domain.test.js         # Fase DB-3H: UUID v4, transacción existente (BEGIN/SELECT/INSERT-o-UPDATE/SELECT/COMMIT) con placeholders `?`, ROLLBACK ante error
├── settings-mariadb.test.js        # Fase DB-3H: integración REAL contra MariaDB, aplica el schema.sql COMPLETO para ejercitar el trigger real de fila única (opcional, ver MARIADB_TEST_URL abajo)
├── infra-services-domain.test.js   # Fase DB-3I: upsert de email_templates (ambas variantes SQL), columna reservada `key`, parseo de JSON/boolean de automation_settings, UUID v4 + placeholders de scheduler_logs, dashboard.service.js con fechas/casts calculados en Node
├── infra-services-mariadb.test.js  # Fase DB-3I: integración REAL contra MariaDB, aplica el schema.sql COMPLETO (opcional, ver MARIADB_TEST_URL abajo)
├── billing-domain.test.js          # Fase DB-3J: ILIKE -> LOWER()/LIKE, FILTER -> CASE WHEN, alias de COUNT, UPDATE+SELECT vs. rowCount seguro (según si el WHERE excluye el estado destino), NEXTVAL/SETVAL branching por driver, revenueLast12Months sin generate_series
├── billing-mariadb.test.js         # Fase DB-3J: integración REAL contra MariaDB, aplica el schema.sql COMPLETO (opcional, ver MARIADB_TEST_URL abajo)
├── fixture-safety.test.js          # Fase DB-2.5: verifica la protección estructural contra el incidente de auto-discovery (ver más abajo)
├── helpers/
│   ├── server.js                   # Levanta un app de Express en un puerto efímero (0) para pegarle con fetch nativo
│   ├── pool-mock.js                # mockPoolQueries (pool.query) y mockPoolConnect (pool.connect(), transacciones) con respuestas canned, sin tocar la base real
│   ├── jwt.js                      # Genera access tokens de prueba con el secret de desarrollo
│   └── express-mocks.js            # Mocks mínimos de req/res/next para probar middlewares sin HTTP
└── fixtures/
    ├── load-config.mjs             # Corrido en un proceso hijo: config/index.js valida al importarse y hace process.exit(1) si falta algo
    ├── scheduler-init.mjs          # Corrido en un proceso hijo: initScheduler() solo tiene efecto la primera vez por proceso
    ├── mariadb-auth-flow.mjs       # Corrido en un proceso hijo por auth-mariadb.test.js, con DATABASE_URL apuntando a la MariaDB descartable
    ├── mariadb-clients-flow.mjs    # Corrido en un proceso hijo por clients-mariadb.test.js, mismo patrón que el de arriba
    ├── mariadb-hosting-flow.mjs    # Corrido en un proceso hijo por hosting-mariadb.test.js, mismo patrón
    ├── mariadb-audit-flow.mjs      # Corrido en un proceso hijo por audit-mariadb.test.js, mismo patrón
    ├── mariadb-domains-flow.mjs    # Corrido en un proceso hijo por domains-mariadb.test.js, mismo patrón
    ├── mariadb-support-flow.mjs    # Corrido en un proceso hijo por support-mariadb.test.js — este test aplica el schema.sql COMPLETO antes (vía apply-mariadb-schema.mjs), no un subconjunto hardcodeado, para poder ejercitar el trigger real de ticket_number
    ├── mariadb-tasks-flow.mjs      # Corrido en un proceso hijo por tasks-mariadb.test.js, mismo patrón de subconjunto que clients/hosting/domains
    ├── mariadb-settings-flow.mjs   # Corrido en un proceso hijo por settings-mariadb.test.js — aplica el schema.sql COMPLETO, mismo motivo que support (trigger de fila única de company_settings)
    ├── mariadb-infra-services-flow.mjs  # Corrido en un proceso hijo por infra-services-mariadb.test.js — aplica el schema.sql COMPLETO (trigger de ticket_number, usado para sembrar un ticket urgente del dashboard)
    └── mariadb-billing-flow.mjs         # Corrido en un proceso hijo por billing-mariadb.test.js — aplica el schema.sql COMPLETO
```

## Línea base de tests (aclarado en la Fase DB-3D)

`npm test` **no da 100% verde hoy, y eso es esperado**: quedan 3 fallos dependientes del entorno (2 en `health.test.js`, 1 en `settings-plans-authorization.test.js`), todos por la misma causa — no hay `backend/.env` con credenciales de un Postgres real en este checkout, y esos 3 tests (a diferencia de casi toda la suite, mockeada) hacen una query real contra la DB. Ver la sección "Línea base de tests" en `docs/MARIADB_MIGRATION.md` para la causa exacta de cada uno (confirmada con logs reales, no asumida) y por qué un reporte anterior de "90/98 pass" resultaba ambiguo sin desglosar los `skip`. Los 2 fallos de `uploads.test.js` que existían en esa misma línea base **ya se corrigieron** (Fase DB-3D: faltaba crear `backend/uploads/tickets/`, mismo patrón que ya usa `settings.routes.js` para `uploads/logos`).

Línea base esperada de un checkout nuevo: **186 tests, 183 pass / 3 fail / 0 skip contra MariaDB** (con `MARIADB_TEST_URL`); **173 pass / 3 fail / 10 skip contra Postgres** (sin ella, los 10 tests de integración MariaDB se saltean).

## Prueba de integración real contra MariaDB (dominios auth/users, clients, hosting_plans/hosting_services, audit_logs, domains, Support/Tickets, Tasks, Settings, Infrastructure Services, Billing)

`auth-mariadb.test.js`, `clients-mariadb.test.js`, `hosting-mariadb.test.js`, `audit-mariadb.test.js`, `domains-mariadb.test.js`, `support-mariadb.test.js`, `tasks-mariadb.test.js`, `settings-mariadb.test.js`, `infra-services-mariadb.test.js` y `billing-mariadb.test.js` son las pruebas de la suite que hablan con un motor MariaDB real en vez de mockear `pool.query`/`pool.connect` — necesarias porque un mock no puede confirmar que las queries convertidas (placeholders `?`, el patrón UPDATE+SELECT que reemplaza a `RETURNING`, la normalización de errores de duplicado, `LOWER()/LIKE` en vez de `ILIKE`, `COUNT(CASE WHEN...)` en vez de `FILTER`, la columna reservada `` `key` ``, fechas calculadas en Node en vez de `DATE_TRUNC`/`INTERVAL`, `NEXTVAL`/`SETVAL` con branching por driver) realmente funcionan contra el driver `mysql2`.

- **Sin `MARIADB_TEST_URL` seteada**: los diez tests se saltean (`skip`), no fallan. Es el caso normal en un entorno sin MariaDB disponible.
- **Con `MARIADB_TEST_URL`** (ej. `mysql://root:@127.0.0.1:13309/ignorado` — el nombre de la base en la URL no importa): cada test crea su propia base temporal (`bitlogic_test_<timestamp>`), la borra al terminar, y nunca toca la base que indica la URL literal ni ninguna otra base existente en ese servidor.
- **Cómo levantar una MariaDB descartable para correr esto localmente**: ver `docs/MARIADB_MIGRATION.md`. Los diez se validaron contra MariaDB 10.4 (XAMPP portable, Opción B del doc) porque Docker no llegó a levantar el daemon en ninguna de las sesiones de esta migración — el schema de estos dominios no depende de ninguna feature específica de 11.x. La instancia descartable necesita `--default-time-zone=+00:00` (agregado en la Fase DB-3D) para que las pruebas de política UTC no den falso negativo.
- **`support-mariadb.test.js`, `settings-mariadb.test.js`, `infra-services-mariadb.test.js` y `billing-mariadb.test.js` son distintos al resto**: en vez de armar un subconjunto de tablas a mano vía `mysql2 multipleStatements`, aplican el **schema.sql completo** con el runner oficial (`apply-mariadb-schema.mjs`, vía CLI) antes de correr su fixture — porque `trg_support_tickets_number` y `trg_company_settings_single_row` usan `DELIMITER` (no ejecutable vía mysql2, ver "Runner reproducible del schema" en `docs/MARIADB_MIGRATION.md`) y hace falta ejercitarlos de verdad (el fixture de infra-services siembra un ticket de soporte para poblar el dashboard, y depende del mismo trigger; el de billing reusa el runner por simplicidad aunque billing en sí no depende de ningún trigger).
- Cada fixture (`fixtures/mariadb-auth-flow.mjs`, `fixtures/mariadb-clients-flow.mjs`, `fixtures/mariadb-hosting-flow.mjs`, `fixtures/mariadb-audit-flow.mjs`, `fixtures/mariadb-domains-flow.mjs`, `fixtures/mariadb-support-flow.mjs`, `fixtures/mariadb-tasks-flow.mjs`, `fixtures/mariadb-settings-flow.mjs`, `fixtures/mariadb-infra-services-flow.mjs`, `fixtures/mariadb-billing-flow.mjs`) tiene un guard explícito (`MARIADB_FIXTURE_RUN=1`, seteado solo por su propio test) — ver la sección de protección de fixtures abajo.
- `clients-mariadb.test.js` además ejercita una FK real (`hosting_services.client_id -> clients.id`) para confirmar que sigue siendo válida tras retirar el `DEFAULT (UUID())` de `clients.id` en la Fase DB-3B.
- `hosting-mariadb.test.js` (Fase DB-3C) cubre el CRUD completo de planes y servicios (incluida la ruta viva `plans.service.js`, no la inalcanzable de `hosting.service.js` — ver "Hallazgo de ruteo" en `docs/MARIADB_MIGRATION.md`), cambio de plan, suspender/reactivar, y ambas FKs de `hosting_services` (`client_id`, `plan_id`) con inserts crudos.
- `audit-mariadb.test.js` (Fase DB-3D) confirma, con un flujo HTTP real de principio a fin, que **el punto ciego de auditoría contra MariaDB desapareció**: crea/edita/borra un cliente, un plan y un servicio (los 3 dominios ya convertidos) y verifica que las 5 acciones generan su fila real en `audit_logs` — antes de esta fase, esas mismas llamadas daban el status code HTTP correcto pero el `INSERT INTO audit_logs` fallaba en silencio por la sintaxis `$N`. También cubre paginación, filtros (`action`/`entityType`/`userId`), JSON con tildes/ñ/emoji de punta a punta, política UTC de `created_at`, y la FK `audit_logs.user_id -> users.id` con `ON DELETE SET NULL` (borrar el usuario no borra el log de auditoría).
- `domains-mariadb.test.js` (Fase DB-3E) cubre CRUD completo + renovación, `expiringInDays`, ambas FKs (`client_id`, `hosting_service_id`) con inserts crudos, `UNIQUE(domain)` case-insensitive (confirma que MariaDB rechaza un dominio duplicado con distinto case, a diferencia de Postgres real), DECIMAL/BOOLEAN exactos, política UTC de `expiration_date`/`registration_date` (`DATE`, sin corrimiento de día), auditoría real de las 4 acciones (crear/editar/renovar/cancelar), y confirma con un `DROP TABLE audit_logs` real a mitad del test que un fallo de auditoría no rompe la acción principal. También reproduce (sin arreglar) el bug preexistente de `deleteDomain` con un dominio inexistente (da 500, no 404 — ver `docs/MARIADB_MIGRATION.md`).
- `support-mariadb.test.js` (Fase DB-3F) cubre creación de tickets (staff y con cliente inexistente/servicio ajeno), el trigger real de `ticket_number` (formato y no-repetición entre dos tickets seguidos), listado/filtros/búsqueda, ownership del portal (403 ante ticket ajeno, mensajes internos invisibles), mensajes (respuesta staff/cliente, interno forzado a no-interno para clientes, adjunto válido/inválido reusando la política de `ticketUpload.js`), asignar/cambiar estado/resolver/cerrar (incluido un PATCH que repite el mismo status sin dar 404 espurio, y un status fuera del `CHECK` dando 500), eliminar con cascada real de mensajes por FK, la FK `client_id` con insert crudo, auditoría real de las 5 acciones con actor correcto, y que un `DROP TABLE audit_logs` real no rompe la acción principal.
- `tasks-mariadb.test.js` (Fase DB-3G) cubre creación (con y sin relaciones opcionales, cliente inexistente -> FK 500), listar/filtrar/buscar case-insensitive, el orden `(due_date IS NULL)` (confirma que una tarea con `due_date` se lista antes que una sin `due_date`, equivalente a `NULLS LAST`), editar (incluido un PATCH que repite el mismo valor sin dar 404 espurio), completar/reabrir con timestamps, eliminar (hard delete, devuelve la fila completa) + eliminar inexistente, la FK `client_id` con insert crudo, auditoría real de las 4 acciones con actor correcto, y que un `DROP TABLE audit_logs` real no rompe la acción principal.
- `settings-mariadb.test.js` (Fase DB-3H) cubre `GET /company` sin configurar (`{}`), alta real con UUID v4 app-side, un segundo `PUT` reusando el mismo id (UPDATE, no una fila nueva — confirmado con `COUNT(*) = 1`), validaciones existentes (nombre requerido, detección de placeholder), subida de logo persistiendo `logo_url` sin pisar el resto de los campos, `readiness` reflejando `companyConfigured: true` tras la primera alta, los stubs de billing/email sin persistencia, auditoría real de 2 ediciones con actor correcto, y que un `DROP TABLE audit_logs` real no rompe la acción principal. También prueba el trigger real `trg_company_settings_single_row` (vía `apply-mariadb-schema.mjs`, no un subconjunto — mismo motivo que `support-mariadb.test.js`).
- `infra-services-mariadb.test.js` (Fase DB-3I) siembra datos determinísticos (cliente, plan, servicio, pagos pagado/pendiente, aviso vencido, dominio por vencer, ticket urgente, tarea vencida y tarea próxima) y afirma los valores numéricos **exactos** que debe devolver `GET /api/dashboard/admin` (deuda total, recaudado del mes, contadores de dominios/tickets/tareas, ventanas de "próximos" a 30/7 días) — la garantía de "igualdad de resultados" entre motores que se pudo validar sin acceso a un Postgres de prueba real (ver `docs/MARIADB_MIGRATION.md`). También cubre el upsert de `email_templates` (`ON DUPLICATE KEY UPDATE` real, un segundo `PUT` no falla por PK duplicada), el CRUD de `automation_settings` (columna reservada `` `key` `` con backticks, `value` JSON parseado a objeto, `toggle` normalizando `enabled` a boolean real — este último detectó un bug real que los tests mockeados no habían atrapado, ver `docs/MARIADB_MIGRATION.md`), y el scheduler (ejecución de un job registrado ad-hoc vía `schedulerService.registerJob`, UUID v4 real en `scheduler_logs.id`, lock anti-duplicados en ejecución concurrente con 409).
- `billing-mariadb.test.js` (Fase DB-3J) cubre: creación de dos avisos seguidos confirmando que `NEXTVAL(payment_notice_number_seq)` (identificador sin comillas, real contra MariaDB) no repite número; búsqueda case-insensitive (`LOWER()/LIKE`); edición con 404 real sobre un id inexistente; `sendNotice`/`cancelNotice` llamados a nivel de servicio (bypass del envío real de SMTP, no configurado en este entorno — ver "Qué NO cubren estos tests") confirmando el patrón rowCount-seguro contra MariaDB real (un reenvío/re-cancelación da 404, no un error de sintaxis); alta de un pago con `paidAt` marcando el aviso relacionado como pagado dentro de una transacción real; `mark-paid` con el mismo patrón rowCount-seguro; edición y baja de pago revirtiendo el aviso relacionado; resúmenes de cliente y global (`CASE WHEN`, `EXTRACT` bindeado, `revenueLast12Months` con meses sin cobro en 0); una FK real de `client_id` inexistente (`ER_NO_REFERENCED_ROW`, 1452); confirmación de que `payments.id`/`payment_notices.id` ya no tienen `DEFAULT (UUID())` (un `INSERT` sin id explícito falla); y auditoría real de crear/cancelar/eliminar un aviso.

## Protección estructural de fixtures (incidente de la Fase DB-3A)

`node --test` sin un patrón explícito descubre por defecto **cualquier** `.js`/`.mjs` bajo un directorio llamado `test` en cualquier profundidad — incluye `test/fixtures/` y `test/helpers/`, no solo los archivos `*.test.js`. Esto pasó desapercibido mientras los únicos fixtures (`load-config.mjs`, `scheduler-init.mjs`) eran inofensivos al correr sueltos (solo leen config / registran cron una vez) — pero durante la Fase DB-3A, el fixture nuevo de integración MariaDB (con escrituras reales) corrió suelto por este mecanismo y escribió datos de prueba en la Postgres local de desarrollo, dos veces, antes de que existiera ninguna protección. Se detectó, se limpió el dato, y se corrigió con **dos capas independientes** (Fase DB-2.5, "protección estructural, no solo confiar en nombres"):

1. **Estructural**: `package.json` corre `node --test "test/**/*.test.js"` en vez de `node --test` a secas — el glob explícito nunca matchea nada bajo `fixtures/` ni `helpers/`, sin importar si un fixture futuro tiene guard o no. Antes de este fix, `node --test` reportaba **73 "tests"** (los 65 reales de auth/users + 8 archivos de `fixtures/`/`helpers/` tratados como test files vacíos, todos "ok" por no hacer nada); con el glob, el conteo real y correcto es **68**.
2. **Guard explícito** en el fixture mismo (`MARIADB_FIXTURE_RUN=1`, seteado solo por `auth-mariadb.test.js` al invocarlo) — defensa en profundidad, por si algún día se lo invoca directo por fuera de `npm test`.

`fixture-safety.test.js` verifica ambas capas automáticamente: que el glob de verdad no incluya `fixtures/`/`helpers/`, y que correr el fixture MariaDB suelto (sin la variable de guard) termine en 0 sin escribir ni imprimir nada.

## Qué se usa como mock/stub

- **PostgreSQL**: `pool.query` se reemplaza por respuestas programadas (`helpers/pool-mock.js`) en los tests de auth, clients, autorización del portal y scheduler. `health.test.js` sí usa la base real para el caso "DB disponible" (una sola query de lectura), y mockea `pool.query` para simular "DB caída". `auth-users-domain.test.js` además mockea `pool.connect()` (`mockPoolConnect`) para probar la transacción de `resetPassword` sin tocar ninguna base.
- **MariaDB**: `auth-mariadb.test.js`, `clients-mariadb.test.js`, `hosting-mariadb.test.js`, `audit-mariadb.test.js`, `domains-mariadb.test.js`, `support-mariadb.test.js`, `tasks-mariadb.test.js`, `settings-mariadb.test.js`, `infra-services-mariadb.test.js` y `billing-mariadb.test.js` son la excepción real (no mock) — ver la sección dedicada más abajo.
- **MercadoPago**: nunca se llama a la API real. `mercadopago-webhook.test.js` prueba `verifyMercadoPagoWebhookSignature()` — una función pura que no hace red — y, a nivel HTTP, confirma que una firma inválida corta el flujo (401) **antes** de llegar a `getMpClient()`/`Payment.get()` (no hay `MP_ACCESS_TOKEN` configurado en el proceso de test; si el código intentara llamar a MP real fallaría con 503, no 401).
- **SMTP / WhatsApp / Telegram / HestiaCP**: ningún test ejercita código que las llame. Los jobs del scheduler que se prueban (`test-lock-job`, `test-failing-job`, etc.) son jobs de prueba registrados ad-hoc, no los reales (`hestia-sync`, `delinquency-detection`, `payment-reminders`), así que no hace falta mockear esas integraciones.
- **Archivos subidos**: los tests de uploads limpian con `t.after()` cualquier archivo que efectivamente se escriba en `backend/uploads/tickets/` durante la corrida — no quedan residuos incluso si una aserción posterior falla.
- **Variables de entorno / arranque**: `config.test.js` y parte de `scheduler.test.js` corren en **procesos hijos separados** (`node:child_process`), porque `config/index.js` valida y hace `process.exit(1)` al importarse si falta algo en producción, y `initScheduler()` solo registra cron una vez de forma significativa por proceso.

## Qué NO cubren estos tests

- Los tres jobs reales del scheduler (`hestia-sync`, `delinquency-detection`, `payment-reminders`) se prueban a nivel de wiring (registro, lock, manejo de errores) con jobs de prueba — no se ejecuta su lógica interna real end-to-end contra HestiaCP/SMTP/WhatsApp reales.
- No hay pruebas de integración con MercadoPago real (checkout real, webhook real de una cuenta real) — solo la verificación de firma, que es lo que se puede probar sin credenciales.
- No hay pruebas end-to-end de UI/frontend (Playwright u otro), ni de Socket.IO más allá del handshake HTTP.
- No hay pruebas de carga/performance ni de concurrencia real de PostgreSQL (el pool se mockea en los tests que lo necesitan).
- La cobertura de código no se mide (no hay `c8`/`nyc` configurado). Los tests actuales (186, contando las diez pruebas de integración MariaDB y la de protección de fixtures) apuntan a los hallazgos de seguridad encontrados y a los endpoints más sensibles, no a cobertura exhaustiva de todos los controllers/servicios.
- **MercadoPago real (checkout/webhook contra la API real con credenciales de sandbox o producción) no se prueba** — mismo motivo que siempre: `mercadopago-webhook.test.js` prueba solo la verificación de firma (sin red), y `billing-mariadb.test.js` prueba solo la capa de persistencia alrededor (placeholders, UUID, `INSERT IGNORE`) con datos simulados, no la integración real con MercadoPago.
- **El envío real de emails disparado desde Billing (`sendNotice`, confirmación de pago) no se prueba end-to-end** — no hay SMTP configurado en este entorno de test (mismo motivo que el resto de la suite, ver más abajo). `billing-mariadb.test.js` llama a `billingService.sendNotice()` directamente (no vía el endpoint HTTP `POST /notices/:id/send`, que si fallara el envío de email no marcaría el aviso como enviado) para validar el SQL/rowCount sin depender de SMTP.
- `settings-plans-authorization.test.js` solo prueba los roles definidos en `users.role` (`super_admin`, `admin`, `soporte`, `finanzas`, `cliente`) contra la política real ya documentada en `docs/PRODUCTION_STATUS.md` — no cubre `soporte` explícitamente en cada endpoint (no tiene acceso a ninguno de los dos módulos, se infiere del mismo mecanismo que se prueba para `finanzas`/`cliente`).

## Verificar la firma de MercadoPago manualmente (sin credenciales reales)

`mercadopago-webhook.test.js` construye una firma válida a mano con `crypto.createHmac('sha256', secret)` sobre el manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`, exactamente como lo hace el validador oficial del SDK (`mercadopago` npm, `WebhookSignatureValidator`, ya instalado). No hace falta una cuenta de MercadoPago para correr estos tests.

## Política respecto a `npm audit`

No se aplican fixes automáticos (`npm audit fix`/`--force`) como parte de este proyecto sin revisión explícita — ver la tabla de hallazgos en `docs/PRODUCTION_STATUS.md`. Cada vulnerabilidad reportada se evalúa por alcanzabilidad real en el código (runtime vs. build-time, directa vs. transitiva) antes de decidir si amerita una actualización, y toda actualización de dependencias se documenta por separado, nunca en el mismo commit que otro cambio.
