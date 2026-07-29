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
    └── mariadb-tasks-flow.mjs      # Corrido en un proceso hijo por tasks-mariadb.test.js, mismo patrón de subconjunto que clients/hosting/domains
```

## Línea base de tests (aclarado en la Fase DB-3D)

`npm test` **no da 100% verde hoy, y eso es esperado**: quedan 3 fallos dependientes del entorno (2 en `health.test.js`, 1 en `settings-plans-authorization.test.js`), todos por la misma causa — no hay `backend/.env` con credenciales de un Postgres real en este checkout, y esos 3 tests (a diferencia de casi toda la suite, mockeada) hacen una query real contra la DB. Ver la sección "Línea base de tests" en `docs/MARIADB_MIGRATION.md` para la causa exacta de cada uno (confirmada con logs reales, no asumida) y por qué un reporte anterior de "90/98 pass" resultaba ambiguo sin desglosar los `skip`. Los 2 fallos de `uploads.test.js` que existían en esa misma línea base **ya se corrigieron** (Fase DB-3D: faltaba crear `backend/uploads/tickets/`, mismo patrón que ya usa `settings.routes.js` para `uploads/logos`).

Línea base esperada de un checkout nuevo: **148 tests, 145 pass / 3 fail / 0 skip contra MariaDB** (con `MARIADB_TEST_URL`); **138 pass / 3 fail / 7 skip contra Postgres** (sin ella, los 7 tests de integración MariaDB se saltean).

## Prueba de integración real contra MariaDB (dominios auth/users, clients, hosting_plans/hosting_services, audit_logs, domains, Support/Tickets, Tasks)

`auth-mariadb.test.js`, `clients-mariadb.test.js`, `hosting-mariadb.test.js`, `audit-mariadb.test.js`, `domains-mariadb.test.js`, `support-mariadb.test.js` y `tasks-mariadb.test.js` son las pruebas de la suite que hablan con un motor MariaDB real en vez de mockear `pool.query`/`pool.connect` — necesarias porque un mock no puede confirmar que las queries convertidas (placeholders `?`, el patrón UPDATE+SELECT que reemplaza a `RETURNING`, la normalización de errores de duplicado, `LOWER()/LIKE` en vez de `ILIKE`, `COUNT(CASE WHEN...)` en vez de `FILTER`) realmente funcionan contra el driver `mysql2`.

- **Sin `MARIADB_TEST_URL` seteada**: los siete tests se saltean (`skip`), no fallan. Es el caso normal en un entorno sin MariaDB disponible.
- **Con `MARIADB_TEST_URL`** (ej. `mysql://root:@127.0.0.1:13309/ignorado` — el nombre de la base en la URL no importa): cada test crea su propia base temporal (`bitlogic_test_<timestamp>`), la borra al terminar, y nunca toca la base que indica la URL literal ni ninguna otra base existente en ese servidor.
- **Cómo levantar una MariaDB descartable para correr esto localmente**: ver `docs/MARIADB_MIGRATION.md`. Los siete se validaron contra MariaDB 10.4 (XAMPP portable, Opción B del doc) porque Docker no llegó a levantar el daemon en ninguna de las sesiones de esta migración — el schema de estos dominios no depende de ninguna feature específica de 11.x. La instancia descartable necesita `--default-time-zone=+00:00` (agregado en la Fase DB-3D) para que las pruebas de política UTC no den falso negativo.
- **`support-mariadb.test.js` es distinto al resto**: en vez de armar un subconjunto de tablas a mano vía `mysql2 multipleStatements`, aplica el **schema.sql completo** con el runner oficial (`apply-mariadb-schema.mjs`, vía CLI) antes de correr su fixture — porque el trigger `trg_support_tickets_number` usa `DELIMITER` (no ejecutable vía mysql2, ver "Runner reproducible del schema" en `docs/MARIADB_MIGRATION.md`) y hace falta ejercitarlo de verdad para probar la generación de `ticket_number`.
- Cada fixture (`fixtures/mariadb-auth-flow.mjs`, `fixtures/mariadb-clients-flow.mjs`, `fixtures/mariadb-hosting-flow.mjs`, `fixtures/mariadb-audit-flow.mjs`, `fixtures/mariadb-domains-flow.mjs`, `fixtures/mariadb-support-flow.mjs`, `fixtures/mariadb-tasks-flow.mjs`) tiene un guard explícito (`MARIADB_FIXTURE_RUN=1`, seteado solo por su propio test) — ver la sección de protección de fixtures abajo.
- `clients-mariadb.test.js` además ejercita una FK real (`hosting_services.client_id -> clients.id`) para confirmar que sigue siendo válida tras retirar el `DEFAULT (UUID())` de `clients.id` en la Fase DB-3B.
- `hosting-mariadb.test.js` (Fase DB-3C) cubre el CRUD completo de planes y servicios (incluida la ruta viva `plans.service.js`, no la inalcanzable de `hosting.service.js` — ver "Hallazgo de ruteo" en `docs/MARIADB_MIGRATION.md`), cambio de plan, suspender/reactivar, y ambas FKs de `hosting_services` (`client_id`, `plan_id`) con inserts crudos.
- `audit-mariadb.test.js` (Fase DB-3D) confirma, con un flujo HTTP real de principio a fin, que **el punto ciego de auditoría contra MariaDB desapareció**: crea/edita/borra un cliente, un plan y un servicio (los 3 dominios ya convertidos) y verifica que las 5 acciones generan su fila real en `audit_logs` — antes de esta fase, esas mismas llamadas daban el status code HTTP correcto pero el `INSERT INTO audit_logs` fallaba en silencio por la sintaxis `$N`. También cubre paginación, filtros (`action`/`entityType`/`userId`), JSON con tildes/ñ/emoji de punta a punta, política UTC de `created_at`, y la FK `audit_logs.user_id -> users.id` con `ON DELETE SET NULL` (borrar el usuario no borra el log de auditoría).
- `domains-mariadb.test.js` (Fase DB-3E) cubre CRUD completo + renovación, `expiringInDays`, ambas FKs (`client_id`, `hosting_service_id`) con inserts crudos, `UNIQUE(domain)` case-insensitive (confirma que MariaDB rechaza un dominio duplicado con distinto case, a diferencia de Postgres real), DECIMAL/BOOLEAN exactos, política UTC de `expiration_date`/`registration_date` (`DATE`, sin corrimiento de día), auditoría real de las 4 acciones (crear/editar/renovar/cancelar), y confirma con un `DROP TABLE audit_logs` real a mitad del test que un fallo de auditoría no rompe la acción principal. También reproduce (sin arreglar) el bug preexistente de `deleteDomain` con un dominio inexistente (da 500, no 404 — ver `docs/MARIADB_MIGRATION.md`).
- `support-mariadb.test.js` (Fase DB-3F) cubre creación de tickets (staff y con cliente inexistente/servicio ajeno), el trigger real de `ticket_number` (formato y no-repetición entre dos tickets seguidos), listado/filtros/búsqueda, ownership del portal (403 ante ticket ajeno, mensajes internos invisibles), mensajes (respuesta staff/cliente, interno forzado a no-interno para clientes, adjunto válido/inválido reusando la política de `ticketUpload.js`), asignar/cambiar estado/resolver/cerrar (incluido un PATCH que repite el mismo status sin dar 404 espurio, y un status fuera del `CHECK` dando 500), eliminar con cascada real de mensajes por FK, la FK `client_id` con insert crudo, auditoría real de las 5 acciones con actor correcto, y que un `DROP TABLE audit_logs` real no rompe la acción principal.
- `tasks-mariadb.test.js` (Fase DB-3G) cubre creación (con y sin relaciones opcionales, cliente inexistente -> FK 500), listar/filtrar/buscar case-insensitive, el orden `(due_date IS NULL)` (confirma que una tarea con `due_date` se lista antes que una sin `due_date`, equivalente a `NULLS LAST`), editar (incluido un PATCH que repite el mismo valor sin dar 404 espurio), completar/reabrir con timestamps, eliminar (hard delete, devuelve la fila completa) + eliminar inexistente, la FK `client_id` con insert crudo, auditoría real de las 4 acciones con actor correcto, y que un `DROP TABLE audit_logs` real no rompe la acción principal.

## Protección estructural de fixtures (incidente de la Fase DB-3A)

`node --test` sin un patrón explícito descubre por defecto **cualquier** `.js`/`.mjs` bajo un directorio llamado `test` en cualquier profundidad — incluye `test/fixtures/` y `test/helpers/`, no solo los archivos `*.test.js`. Esto pasó desapercibido mientras los únicos fixtures (`load-config.mjs`, `scheduler-init.mjs`) eran inofensivos al correr sueltos (solo leen config / registran cron una vez) — pero durante la Fase DB-3A, el fixture nuevo de integración MariaDB (con escrituras reales) corrió suelto por este mecanismo y escribió datos de prueba en la Postgres local de desarrollo, dos veces, antes de que existiera ninguna protección. Se detectó, se limpió el dato, y se corrigió con **dos capas independientes** (Fase DB-2.5, "protección estructural, no solo confiar en nombres"):

1. **Estructural**: `package.json` corre `node --test "test/**/*.test.js"` en vez de `node --test` a secas — el glob explícito nunca matchea nada bajo `fixtures/` ni `helpers/`, sin importar si un fixture futuro tiene guard o no. Antes de este fix, `node --test` reportaba **73 "tests"** (los 65 reales de auth/users + 8 archivos de `fixtures/`/`helpers/` tratados como test files vacíos, todos "ok" por no hacer nada); con el glob, el conteo real y correcto es **68**.
2. **Guard explícito** en el fixture mismo (`MARIADB_FIXTURE_RUN=1`, seteado solo por `auth-mariadb.test.js` al invocarlo) — defensa en profundidad, por si algún día se lo invoca directo por fuera de `npm test`.

`fixture-safety.test.js` verifica ambas capas automáticamente: que el glob de verdad no incluya `fixtures/`/`helpers/`, y que correr el fixture MariaDB suelto (sin la variable de guard) termine en 0 sin escribir ni imprimir nada.

## Qué se usa como mock/stub

- **PostgreSQL**: `pool.query` se reemplaza por respuestas programadas (`helpers/pool-mock.js`) en los tests de auth, clients, autorización del portal y scheduler. `health.test.js` sí usa la base real para el caso "DB disponible" (una sola query de lectura), y mockea `pool.query` para simular "DB caída". `auth-users-domain.test.js` además mockea `pool.connect()` (`mockPoolConnect`) para probar la transacción de `resetPassword` sin tocar ninguna base.
- **MariaDB**: `auth-mariadb.test.js`, `clients-mariadb.test.js`, `hosting-mariadb.test.js`, `audit-mariadb.test.js`, `domains-mariadb.test.js`, `support-mariadb.test.js` y `tasks-mariadb.test.js` son la excepción real (no mock) — ver la sección dedicada más abajo.
- **MercadoPago**: nunca se llama a la API real. `mercadopago-webhook.test.js` prueba `verifyMercadoPagoWebhookSignature()` — una función pura que no hace red — y, a nivel HTTP, confirma que una firma inválida corta el flujo (401) **antes** de llegar a `getMpClient()`/`Payment.get()` (no hay `MP_ACCESS_TOKEN` configurado en el proceso de test; si el código intentara llamar a MP real fallaría con 503, no 401).
- **SMTP / WhatsApp / Telegram / HestiaCP**: ningún test ejercita código que las llame. Los jobs del scheduler que se prueban (`test-lock-job`, `test-failing-job`, etc.) son jobs de prueba registrados ad-hoc, no los reales (`hestia-sync`, `delinquency-detection`, `payment-reminders`), así que no hace falta mockear esas integraciones.
- **Archivos subidos**: los tests de uploads limpian con `t.after()` cualquier archivo que efectivamente se escriba en `backend/uploads/tickets/` durante la corrida — no quedan residuos incluso si una aserción posterior falla.
- **Variables de entorno / arranque**: `config.test.js` y parte de `scheduler.test.js` corren en **procesos hijos separados** (`node:child_process`), porque `config/index.js` valida y hace `process.exit(1)` al importarse si falta algo en producción, y `initScheduler()` solo registra cron una vez de forma significativa por proceso.

## Qué NO cubren estos tests

- Los tres jobs reales del scheduler (`hestia-sync`, `delinquency-detection`, `payment-reminders`) se prueban a nivel de wiring (registro, lock, manejo de errores) con jobs de prueba — no se ejecuta su lógica interna real end-to-end contra HestiaCP/SMTP/WhatsApp reales.
- No hay pruebas de integración con MercadoPago real (checkout real, webhook real de una cuenta real) — solo la verificación de firma, que es lo que se puede probar sin credenciales.
- No hay pruebas end-to-end de UI/frontend (Playwright u otro), ni de Socket.IO más allá del handshake HTTP.
- No hay pruebas de carga/performance ni de concurrencia real de PostgreSQL (el pool se mockea en los tests que lo necesitan).
- La cobertura de código no se mide (no hay `c8`/`nyc` configurado). Los tests actuales (148, contando las siete pruebas de integración MariaDB y la de protección de fixtures) apuntan a los hallazgos de seguridad encontrados y a los endpoints más sensibles, no a cobertura exhaustiva de todos los controllers/servicios.
- `settings-plans-authorization.test.js` solo prueba los roles definidos en `users.role` (`super_admin`, `admin`, `soporte`, `finanzas`, `cliente`) contra la política real ya documentada en `docs/PRODUCTION_STATUS.md` — no cubre `soporte` explícitamente en cada endpoint (no tiene acceso a ninguno de los dos módulos, se infiere del mismo mecanismo que se prueba para `finanzas`/`cliente`).

## Verificar la firma de MercadoPago manualmente (sin credenciales reales)

`mercadopago-webhook.test.js` construye una firma válida a mano con `crypto.createHmac('sha256', secret)` sobre el manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`, exactamente como lo hace el validador oficial del SDK (`mercadopago` npm, `WebhookSignatureValidator`, ya instalado). No hace falta una cuenta de MercadoPago para correr estos tests.

## Política respecto a `npm audit`

No se aplican fixes automáticos (`npm audit fix`/`--force`) como parte de este proyecto sin revisión explícita — ver la tabla de hallazgos en `docs/PRODUCTION_STATUS.md`. Cada vulnerabilidad reportada se evalúa por alcanzabilidad real en el código (runtime vs. build-time, directa vs. transitiva) antes de decidir si amerita una actualización, y toda actualización de dependencias se documenta por separado, nunca en el mismo commit que otro cambio.
