# Bitlogic Client Hub — Estado de producción

**Última actualización:** 2026-07-29
**Fuente de verdad vigente.** Todo lo que esté en `docs/archive/` es documentación histórica de sesiones de desarrollo anteriores y **no debe usarse como referencia** — puede contradecir este documento y el código real. Ante cualquier duda, este archivo y el código ganan siempre.

---

## Qué es

Sistema interno de Bitlogic (empresa de hosting) para gestionar clientes, servicios de hosting, dominios, facturación/cobranza, soporte y tareas, más un portal separado para que los clientes finales vean sus propios datos y paguen. Uso privado de Bitlogic — no es un producto multi-tenant.

## Arquitectura real

- **Frontend:** React + TanStack Start (SSR real, no SPA estática) + Vite. Build genera `dist/client/` y `dist/server/`.
- **Backend:** Express + Node ESM, MariaDB 11.4 con SQL directo (sin ORM) — **único motor soportado desde la Fase DB-5A**. PostgreSQL fue removido por completo del runtime (`pg` ya no es una dependencia, no queda ninguna capa dual-driver ni branching por `config.db.driver`): `backend/src/db/pool.js` usa solo `mysql2/promise`, y `backend/src/config/index.js` rechaza explícitamente cualquier `DATABASE_URL` con esquema `postgresql://` al arrancar. `backend/db/schema.sql` es la única fuente de verdad del schema (20 tablas, `utf8mb4`/`utf8mb4_unicode_520_ci`, validado contra MariaDB 11.4 real), sin ningún `DEFAULT (UUID())` restante. Ver `docs/MARIADB_MIGRATION.md` para el historial completo de la migración (fases DB-0 a DB-5A). **Importante:** esto es trabajo de código/branch (`migration/mariadb-only-v1`), todavía no mergeado a `main` ni desplegado — el VPS real no fue tocado y no hay ninguna base de datos de producción creada todavía; cuando se despliegue, la base se crea fresca (Hestia/phpMyAdmin), no se migra ningún dato de un Postgres anterior.
- **Tiempo real:** Socket.IO para el chat de tickets — sin adapter compartido, por lo que el backend **debe** correr en 1 sola instancia (fork), nunca en cluster/múltiples workers.
- **Auth:** JWT access token (15 min, en memoria del navegador) + refresh token en cookie httpOnly (30 días / 1 día).
- **Proceso:** PM2 con `ecosystem.config.js` (raíz del repo) — 2 apps (`bitlogic-backend`, `bitlogic-frontend`), ambas fork/1 instancia.

## Módulos funcionales — estado

Todos los módulos del panel admin y del portal cliente (Clientes, Servicios, Planes, Dominios, Pagos, Avisos, Cobranza, Soporte/Tickets, Tareas, Usuarios y permisos, Workflows, Plantillas, Logs de Email, Backups, Auditoría, Dashboard/Negocio, Configuración, Portal del cliente) están **funcionales y probados** con datos reales (Playwright + pruebas manuales de API).

**Automatizaciones:** los 3 jobs (`hestia-sync`, `delinquency-detection`, `payment-reminders`) ahora corren solos vía `node-cron` (`SCHEDULER_ENABLED=true` en producción), además de poder seguir disparándose a mano desde el panel — ambos caminos comparten el mismo lock, así que no pueden pisarse. Ver `docs/SCHEDULER.md` para horarios, timezone y cómo deshabilitarlo. Antes de esta fase, la ejecución manual estaba rota (los jobs nunca se registraban, todo intento daba 404) — quedó corregido de paso.

- `hestia-sync` y `delinquency-detection` son de **solo lectura**: no sincronizan nada en Hestia ni suspenden servicios, solo reportan. `delinquency-detection` en particular no puede alterar ni suspender un servicio bajo ninguna circunstancia — no ejecuta ningún `UPDATE`.
- `payment-reminders` sí manda emails reales, pero solo si el toggle correspondiente (`reminder_7_days`/`3_days`/`due_today`) está habilitado en automation_settings — hoy los 3 están **deshabilitados** por defecto.

## Integraciones — estado real

| Integración | Estado |
|---|---|
| HestiaCP (lectura de disco/dominios) | ✅ Funcional |
| SMTP (mailbox real en `mail.bitlogic.com.ar`) | ✅ Funciona a nivel código. ⚠️ Entrega afectada por falta de registro PTR en el proveedor del VPS (CTL Argentina) — pendiente de su lado |
| MercadoPago (checkout + webhook con firma verificada) | ⚠️ Código completo, falta `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` reales de producción |
| Telegram (avisos de tickets al staff) | ⚠️ Código completo y probado, falta crear el bot y cargar el token |
| WhatsApp (Baileys, recordatorios a clientes) | ⚠️ Código completo, QR de vinculación probado contra WhatsApp real. Apagado hasta vincular el número real de la empresa |

## Bloqueantes conocidos para producción

1. `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`/`CHAT_ID` sin cargar.
2. PTR de la IP del VPS sin configurar por el proveedor (afecta entrega de email).
3. No usar `npm run seed:demo` contra la base de producción — carga datos de demo ficticios (además se niega a correr si `NODE_ENV=production`, y exige `--yes`/`CONFIRM_DEMO_SEED=true`). La base de producción real se crea fresca directamente en MariaDB (Hestia/phpMyAdmin en el VPS) con `npm run db:schema:mariadb` + `npm run db:create-admin` — no hay datos reales de un Postgres anterior que migrar, no corresponde ningún `pg_dump`/`pg_restore`.
4. El scheduler usa un lock en memoria (`runningJobs`), correcto para 1 sola instancia PM2 (fork, el modo actual). Si en algún momento se escala a más de una instancia, ese lock deja de garantizar exclusión — hace falta un lock a nivel de base de datos (`GET_LOCK()` en MariaDB) antes de escalar.
5. `npm audit` reporta 7 vulnerabilidades en el backend y 3 en el frontend — todas evaluadas y ninguna aplicada todavía (ver tabla abajo). Las de mayor severidad práctica (`bcrypt`, `nodemailer`) requieren un bump de versión mayor con pruebas dedicadas.
6. ~~A verificar (hallazgo de la Fase DB-3F): gap de columnas de adjuntos en `support_ticket_messages` contra el Postgres real del VPS~~ — **ya no aplica desde la Fase DB-5A**: PostgreSQL fue removido del todo, `backend/db/schema.sql` (única fuente de verdad) ya incluye `attachment_url`/`attachment_type`/`attachment_name` y `message` nullable.
7. ~~A verificar (hallazgo de la Fase DB-3H): gap de `company_settings.logo_url` contra el Postgres real del VPS~~ — **ya no aplica desde la Fase DB-5A**, mismo motivo que el punto anterior. Sigue vigente el bug de `updateCompanyLogo` no enviando `company_name` (`NOT NULL`) en su `INSERT` — subir un logo antes de guardar la configuración de empresa una sola vez sigue rompiendo por violación de `NOT NULL`, no relacionado con el motor.
8. **Hallazgo de la Fase DB-3I, corregido**: `automation_settings.enabled` (BOOLEAN) volvía como `0`/`1` en vez de `true`/`false` contra MariaDB — corregido en `automation-settings.service.js` (normalizado con `!!row.enabled`). Se menciona acá porque es la clase de bug que solo aparece al validar contra un motor real.
9. ~~`email.service.js` tenía 4 funciones con placeholders `$1` de Postgres sin convertir~~ — **resuelto en la Fase DB-3K**, junto con un quinto hallazgo no detectado antes (`listLogs()`, módulo Logs de Email). Cero SQL Postgres-only en `email.service.js` (ni en ningún otro archivo de runtime), verificado con un test de guardia automatizado.
10. **Bug preexistente corregido en la Fase DB-3K, no introducido por esta migración**: `onboarding.routes.js` consultaba una tabla `billing_notices` que **nunca existió** en este proyecto (la tabla real es `payment_notices`) — `GET /api/onboarding/` daba 500, desde antes de esta migración. Ya corregido.
11. **Backups convertido en la Fase DB-3K, corrigió de paso un bug real**: el módulo Backups (antes 100% `pg_dump`) tenía además un `INSERT` con 6 columnas pero solo 5 valores en el `VALUES` — no hubiera funcionado en **ningún** motor. Ya corregido y probado contra MariaDB real (dump real con `mariadb-dump`/`mysqldump`, único método soportado desde DB-5A).
12. **MariaDB es el único motor soportado desde el cierre de la Fase DB-5A**: `pg` fue removido de `package.json`, `db/pool.js` usa solo `mysql2/promise`, y `config/index.js` rechaza `postgresql://` al arrancar con un error fatal claro. La suite de tests corre 198/198 verde contra una MariaDB 11.4 descartable, 0 skipped. **Esto sigue siendo trabajo de código en la rama `migration/mariadb-only-v1`, no mergeado a `main` ni desplegado**: el VPS no fue tocado y no existe todavía ninguna base de datos de producción — cuando se despliegue, se crea fresca (Hestia/phpMyAdmin), sin migrar datos de ningún Postgres anterior.

### Hallazgos de seguridad resueltos en esta fase

- **Firma del webhook de MercadoPago**: ahora se verifica `x-signature`/`x-request-id` contra la documentación oficial de MercadoPago, usando el validador que trae el propio SDK (`mercadopago`, `WebhookSignatureValidator`). Ver `backend/src/routes/mercadopago.routes.js` y `docs/TESTING.md`.
- **Autenticación paralela**: `backend/src/middlewares/auth.js` (usado por Configuración y Planes, sin reconsultar la DB) se eliminó — todas las rutas usan ahora `authRequired.js`. De paso se corrigió que el audit log de cambios en Configuración/Planes grababa `user_id: null, user_name: "System"` siempre, por la misma causa.
- **Warning de PostgreSQL** ("Calling client.query() when the client is already executing a query"): causado por un `SET client_encoding` redundante disparado sin esperar en el listener `connect` del pool — la base ya negocia UTF8 por default. Se quitó esa query.
- **Autorización de Configuración y Planes**: antes, cualquier usuario autenticado (incluido un cliente del portal, vía un token forjado o robado) podía leer/escribir configuración de empresa o crear/editar/eliminar planes — solo se exigía estar logueado, sin chequeo de rol. Ahora cada endpoint exige el rol real que ya asume el frontend (`src/lib/auth.tsx`, `PERMISSIONS`) — ver la matriz en "Roles y permisos" abajo. El portal del cliente y el resto de los módulos (Avisos, Plantillas, servicios) no se vieron afectados: se verificó qué páginas consumen cada endpoint antes de restringirlo.

## Roles y permisos

Roles reales (constraint de `users.role`): `super_admin`, `admin`, `soporte`, `finanzas`, `cliente`. No existe un rol "staff" en la base — es una agrupación conceptual del backend (`requireStaff` en `backend/src/middlewares/requireRole.js`) que junta `admin`+`soporte`+`finanzas` (+`super_admin`).

| Módulo | Acción | Roles permitidos |
|---|---|---|
| Configuración (empresa, facturación, hosting/Hestia, pagos, email, readiness) | Lectura | `super_admin` |
| Configuración → datos de empresa (`GET /api/settings/company`) | Lectura | `super_admin`, `admin`, `finanzas` (también la usa la página Avisos) |
| Configuración (todo lo anterior) | Escritura | `super_admin` |
| Plantillas de email (`/api/settings/templates`) | Lectura y escritura | `super_admin`, `admin` |
| Planes — listado (`GET /api/hosting/plans`) | Lectura | Cualquiera (sin restricción de rol — lo usa el portal del cliente y los formularios de servicios) |
| Planes — crear/editar/eliminar | Escritura | `super_admin` |

Esta matriz refleja exactamente `PERMISSIONS` en `src/lib/auth.tsx` (frontend): `configuracion` y `planes` solo están en la lista de `super_admin`; `plantillas` está en `super_admin` y `admin`; `avisos` (que consume el logo de empresa) está en `super_admin`, `admin` y `finanzas`. La política backend no inventa roles nuevos ni reglas nuevas — cierra la brecha entre lo que el frontend ya asumía y lo que el backend efectivamente exigía.

### `npm audit` — hallazgos evaluados (nada aplicado)

| Paquete | Tipo | Alcance | Severidad npm | Riesgo práctico | Fix disponible | Acción |
|---|---|---|---|---|---|---|
| `bcrypt` (backend) | directo | build-time (instalación de binario nativo vía node-pre-gyp/tar) | high | Bajo — el código vulnerable no corre en runtime, solo durante `npm install` | `bcrypt@6.0.0` (mayor) | Diferido — requiere probar la migración de API |
| `tar` (backend, transitivo vía bcrypt) | transitivo | build-time | critical (npm) | Bajo — mismo motivo que bcrypt, no se ejecuta en runtime | vía `bcrypt@6.0.0` | Diferido junto con bcrypt |
| `nodemailer` (backend) | directo | runtime, alcanzable (se usa en cada email real) | high | Medio — varios CVEs no aplican a cómo lo usamos (no usamos OAuth2, `raw`, `jsonTransport` ni `envelope.size`); el de mayor chance real es el DoS de `addressparser` sobre direcciones de `clients.email` | `nodemailer@9.0.3` (mayor) | Diferido — prioridad más alta para una fase dedicada, requiere pruebas end-to-end con SMTP real |
| `body-parser` (backend, transitivo vía express) | transitivo | runtime, pero no alcanzable — el bug requiere un valor de `limit` inválido y nosotros pasamos `"1mb"` (válido) | low | Muy bajo | `body-parser@1.20.6` (patch) | Diferido — no cumple "cuenta con pruebas dedicadas" en esta fase |
| `protobufjs` (backend, transitivo vía @whiskeysockets/baileys) | transitivo | runtime solo si `WHATSAPP_ENABLED=true` (hoy `false`) | moderate | Muy bajo hoy (integración apagada); requeriría un `.proto` malicioso, no expuesto por baileys | patch dentro de 7.x | Diferido |
| `brace-expansion` (backend y raíz) | transitivo vía `bcrypt`→node-pre-gyp y vía `nodemon`/`eslint` (dev-only) | build-time / dev-only | high (npm) | Ninguno — no se ejecuta en el servidor desplegado | patch | Diferido, sin urgencia |
| `js-yaml`, `postcss` (raíz) | transitivos vía tooling de build (`@tanstack/react-start`, `eslint`, `tailwindcss`) | build-time, no se envía al browser | high (npm) | Ninguno en producción | patch | Diferido, sin urgencia |

Ninguna actualización cumplía simultáneamente las condiciones para aplicarse en esta fase (pequeña y compatible, sin `--force`, riesgo de runtime real, con pruebas dedicadas, documentada aparte). `npm outdated` se corrió en ambos proyectos como informe adicional — hay actualizaciones menores disponibles (Radix UI, TanStack, etc.) sin relación con seguridad, no evaluadas acá.

## Dónde está la documentación

- Este archivo (`docs/PRODUCTION_STATUS.md`): estado funcional y de integraciones vigente.
- `docs/MARIADB_MIGRATION.md`: historial completo de la migración a MariaDB (fases DB-0 a DB-5A), política de UUID/timezone/collation. MariaDB es el único motor desde el cierre de la migración — para levantar el proyecto hoy, usar `README.md` y este documento, no tratar esa guía como un proceso todavía en curso.
- `docs/SCHEDULER.md`: horarios, timezone, cómo deshabilitar el scheduler y revisar logs de automatizaciones.
- `docs/TESTING.md`: cómo correr los tests del backend, qué cubren y qué no.
- `DEPLOYMENT_GUIDE.md` (raíz): guía paso a paso de deploy, ya corregida y validada.
- `docs/archive/`: documentación histórica de sesiones de desarrollo — **no usar como referencia**, puede estar desactualizada o contradecir este documento.
