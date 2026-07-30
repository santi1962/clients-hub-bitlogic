# Bitlogic Backend

API REST en Node.js + Express + MariaDB para Bitlogic Client Hub.

## Requisitos

- Node.js **>=22.12.0** (lo exige `@tanstack/react-start` del frontend; el backend sigue la misma política — una sola versión mínima para todo el repo. Se hace cumplir con `.npmrc` (`engine-strict=true`) y con un chequeo en runtime al arrancar `server.js`, ver `src/utils/assert-node-version.js`)
- MariaDB 11.4 (único motor soportado — PostgreSQL fue removido del runtime)
- npm

> **Windows:** `bcrypt` requiere compilación nativa. Si `npm install` falla con errores de node-gyp,
> instalá primero las herramientas de build:
> ```
> npm install --global windows-build-tools
> ```
> O usar Visual Studio Build Tools + Python 3.x.

---

## Instalación

```bash
cd backend
npm install
```

---

## Configuración

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string de MariaDB (`postgresql://` es rechazado al arrancar) | `mysql://root:pass@localhost:3306/bitlogic` |
| `JWT_ACCESS_SECRET` | Secreto para access tokens (≥ 64 chars) | generado abajo |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens (diferente) | generado abajo |
| `CORS_ORIGIN` | URL del frontend | `http://localhost:5173` |
| `PORT` | Puerto del servidor | `3001` |

Generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Schema

`backend/db/schema.sql` es la única fuente de verdad del schema (20 tablas, InnoDB, `utf8mb4`/`utf8mb4_unicode_520_ci`). Se aplica con el runner oficial, nunca a mano:

```bash
npm run db:schema:mariadb -- --url mysql://user:pass@host:port/dbname
```

Requiere pasar `--url` explícito (nunca lee `DATABASE_URL`) y rechaza nombres de base que parezcan de test a menos que se agregue `--confirm-production` (para un init real de producción). Las 16 migraciones históricas de PostgreSQL que existían antes de la migración a MariaDB quedaron archivadas, solo como referencia no ejecutable, en `backend/db/archive/postgresql-migrations/`.

Para crear el primer usuario `super_admin` real (no un dato de demo):

```bash
npm run db:create-admin  # lee ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD de .env, idempotente por email
```

---

## Seed (datos de DEMO)

Inserta datos ficticios de demostración — no usar en producción:

```bash
npm run seed:demo -- --yes   # o CONFIRM_DEMO_SEED=true npm run seed:demo
```

Se niega a correr si `NODE_ENV=production`. Los seeds numerados viven en `backend/src/seeds/` (admin de demo, planes/clientes/servicios, avisos/pagos, dominios, tickets, usuarios cliente, tareas) y son idempotentes.

---

## Levantar el servidor

```bash
npm run dev     # desarrollo con hot-reload (nodemon)
npm start       # producción
```

Servidor en `http://localhost:3001`.

---

## Flujo completo de autenticación

```
┌─────────────┐     POST /api/auth/login          ┌───────────────┐
│   Frontend  │ ─────────────────────────────────► │    Backend    │
│             │ ◄───────────────────────────────── │               │
│             │   { accessToken } + refresh cookie │               │
│             │   (httpOnly, sameSite=lax)          │               │
│             │                                    │               │
│  Guarda     │                                    │  Guarda hash  │
│  accessToken│                                    │  del refresh  │
│  en memoria │                                    │  en DB        │
└─────────────┘                                    └───────────────┘

Cada request autenticada:
  Authorization: Bearer <accessToken>  (15 minutos de vida)

Cuando el accessToken expira → el interceptor en request() detecta 401 y:
  1. Llama POST /api/auth/refresh (envía la cookie automáticamente)
  2. Backend verifica hash del refresh token en DB
  3. Backend devuelve nuevo accessToken
  4. Frontend reintenta la request original con el nuevo token

Logout:
  1. POST /api/auth/logout → backend revoca el refresh token en DB
  2. Cookie borrada del browser
  3. accessToken borrado de memoria
  4. Redirect a /login
```

### Tokens

| Token | Almacenamiento | Duración | Descripción |
|-------|---------------|----------|-------------|
| Access token | Memoria JS | 15 min | JWT firmado; autoriza requests con Bearer |
| Refresh token | Cookie httpOnly | 30 días (remember=true) / 1 día | Opaco; hash guardado en DB; rota en /refresh |

### Seguridad implementada

- `httpOnly` en cookie → inaccesible desde JS (protege contra XSS)
- `sameSite: lax` → funciona entre puertos en localhost, bloquea CSRF en prod
- `secure: true` en producción → solo HTTPS
- Refresh token guardado como SHA-256 hash en DB → si se compromete la DB, el token crudo es inútil
- Rate limit en `/api/auth/login` → 10 intentos por 15 minutos por IP
- Respuesta idéntica para "usuario no existe" y "password incorrecta" → anti-enumeración
- Refresh tokens revocados con timestamp en lugar de borrados → audit trail

---

## Endpoints

### Auth

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | ✗ | Login con email + password |
| `POST` | `/api/auth/logout` | ✗ | Revoca refresh token y borra cookie |
| `POST` | `/api/auth/refresh` | cookie | Renueva access token desde refresh cookie |
| `GET`  | `/api/auth/me` | Bearer | Devuelve usuario autenticado |

### Clientes

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/clients` | Bearer | Todos los staff |
| `POST`   | `/api/clients` | Bearer | Admin+ |
| `GET`    | `/api/clients/:id` | Bearer | Todos los staff |
| `PATCH`  | `/api/clients/:id` | Bearer | Admin+ |
| `DELETE` | `/api/clients/:id` | Bearer | Admin+ (soft delete) |

Query params para GET /api/clients: `search`, `status` (active/inactive), `page`, `limit`

### Planes de hosting

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`   | `/api/hosting/plans` | Bearer | Todos los staff |
| `POST`  | `/api/hosting/plans` | Bearer | Admin+ |
| `PATCH` | `/api/hosting/plans/:id` | Bearer | Admin+ |

### Servicios de hosting

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/hosting/services` | Bearer | Todos los staff |
| `POST`   | `/api/hosting/services` | Bearer | Admin+ |
| `GET`    | `/api/hosting/services/:id` | Bearer | Todos los staff |
| `PATCH`  | `/api/hosting/services/:id` | Bearer | Admin+ |
| `POST`   | `/api/hosting/services/:id/suspend` | Bearer | Admin+ |
| `POST`   | `/api/hosting/services/:id/reactivate` | Bearer | Admin+ |
| `POST`   | `/api/hosting/services/:id/change-plan` | Bearer | Admin+ |

Query params para GET /api/hosting/services: `clientId`, `planId`, `search`, `status`, `page`, `limit`

Statuses válidos en DB: `active`, `due_soon`, `pending_payment`, `overdue`, `suspended`, `cancelled`

### Avisos de pago

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/billing/notices` | Bearer | Staff + cliente (ve solo los suyos) |
| `POST`   | `/api/billing/notices` | Bearer | Admin+, Finanzas |
| `GET`    | `/api/billing/notices/:id` | Bearer | Staff |
| `PATCH`  | `/api/billing/notices/:id` | Bearer | Admin+, Finanzas |
| `POST`   | `/api/billing/notices/:id/send` | Bearer | Admin+, Finanzas |
| `POST`   | `/api/billing/notices/:id/pdf` | Bearer | Staff (placeholder) |
| `POST`   | `/api/billing/notices/:id/cancel` | Bearer | Admin+, Finanzas |

Query params para GET /api/billing/notices: `clientId`, `serviceId`, `status`, `search`, `page`, `limit`

Estados válidos: `draft`, `pending`, `sent`, `paid`, `overdue`, `cancelled`

### Pagos

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/billing/payments` | Bearer | Staff + cliente (ve solo los suyos) |
| `POST`   | `/api/billing/payments` | Bearer | Admin+, Finanzas |
| `GET`    | `/api/billing/payments/:id` | Bearer | Staff |
| `PATCH`  | `/api/billing/payments/:id` | Bearer | Admin+, Finanzas |
| `POST`   | `/api/billing/payments/:id/mark-paid` | Bearer | Admin+, Finanzas |

Query params para GET /api/billing/payments: `clientId`, `serviceId`, `status`, `method`, `periodMonth`, `periodYear`, `page`, `limit`

Estados válidos: `pending`, `paid`, `overdue`, `cancelled`  
Métodos válidos: `manual`, `transfer`, `cash`, `mercadopago`, `paypal`

### Resumen financiero

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/billing/clients/:clientId/summary` | Bearer | Resumen de un cliente |
| `GET` | `/api/billing/summary` | Bearer | Centro de cobranzas global (Admin+, Finanzas) |

### Dominios

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/domains` | Bearer | Todos los staff |
| `POST`   | `/api/domains` | Bearer | Admin+ |
| `GET`    | `/api/domains/:id` | Bearer | Todos los staff |
| `PATCH`  | `/api/domains/:id` | Bearer | Admin+ |
| `DELETE` | `/api/domains/:id` | Bearer | Admin+ (soft delete) |
| `POST`   | `/api/domains/:id/renew` | Bearer | Admin+ |

Query params para GET /api/domains: `clientId`, `serviceId`, `status`, `search`, `expiringInDays`, `page`, `limit`

Estados válidos: `active`, `due_soon`, `expired`, `transferred`, `cancelled`

### Soporte (Tickets)

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/support` | Bearer | Staff (ve todos); Cliente (ve solo los suyos) |
| `POST`   | `/api/support` | Bearer | Staff + Cliente |
| `GET`    | `/api/support/:id` | Bearer | Staff + propietario del ticket |
| `PATCH`  | `/api/support/:id` | Bearer | Staff (cambiar status/prioridad) |
| `POST`   | `/api/support/:id/messages` | Bearer | Staff + propietario |
| `POST`   | `/api/support/:id/assign` | Bearer | Staff |
| `POST`   | `/api/support/:id/resolve` | Bearer | Staff |
| `POST`   | `/api/support/:id/close` | Bearer | Staff |

Query params para GET /api/support: `clientId`, `serviceId`, `status`, `priority`, `assignedTo`, `search`, `page`, `limit`

Estados válidos: `open`, `in_progress`, `waiting_client`, `resolved`, `closed`  
Prioridades válidas: `low`, `normal`, `high`, `urgent`

Números de ticket: formato automático `TK-{YEAR}-{NNNN}` (ej. TK-2026-0042)

### Tareas internas

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET`    | `/api/tasks` | Bearer | Staff (solo staff) |
| `POST`   | `/api/tasks` | Bearer | Staff |
| `GET`    | `/api/tasks/:id` | Bearer | Staff |
| `PATCH`  | `/api/tasks/:id` | Bearer | Staff |
| `DELETE` | `/api/tasks/:id` | Bearer | Staff (soft delete → cancelled) |
| `POST`   | `/api/tasks/:id/complete` | Bearer | Staff |
| `POST`   | `/api/tasks/:id/reopen` | Bearer | Staff |

Query params para GET /api/tasks: `status`, `priority`, `assignedTo`, `clientId`, `serviceId`, `domainId`, `ticketId`, `search`, `dueBefore`, `page`, `limit`

Estados válidos: `pending`, `in_progress`, `completed`, `cancelled`  
Prioridades válidas: `low`, `normal`, `high`, `urgent`

**Seguridad:** Solo staff puede acceder. Clientes no pueden ver tareas.

### Dashboard

| Método | Ruta | Auth | Quién puede |
|--------|------|------|-------------|
| `GET` | `/api/dashboard/admin` | Bearer | Staff (super_admin, admin, soporte, finanzas) |

Devuelve: `activeClients`, `activeServices`, `pendingPaymentsCount`, `monthlyRevenue`, `collectedThisMonth`, `totalDebt`, `overdueNoticesCount`, `newClientsThisMonth`, `upcomingServices[]`, `clientsWithDebt[]`, `recentPayments[]`, `recentNotices[]`, `activeDomainsCount`, `dueSoonDomainsCount`, `expiredDomainsCount`, `upcomingDomains[]`, `openTicketsCount`, `urgentTicketsCount`, `recentTickets[]`, `pendingTasksCount`, `urgentTasksCount`, `overdueTasksCount`, `upcomingTasks[]`

### Sistema

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET`  | `/api/health` | ✗ | Estado del servidor y DB |

---

## Probar con curl

### Login
```bash
curl -s -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bitlogic.com.ar","password":"Cambiar123!","remember":true}' | jq .
```

### Me (con access token del login)
```bash
TOKEN="<access_token_del_login>"
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Refresh (usa la cookie guardada por -c)
```bash
curl -s -b cookies.txt -c cookies.txt -X POST \
  http://localhost:3001/api/auth/refresh | jq .
```

### Health check
```bash
curl -s http://localhost:3001/api/health | jq .
```

### Crear aviso de pago
```bash
TOKEN="<access_token>"
curl -s -X POST http://localhost:3001/api/billing/notices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "22222222-2222-2222-2222-000000000001",
    "hostingServiceId": "33333333-3333-3333-3333-000000000001",
    "periodMonth": 7,
    "periodYear": 2026,
    "dueDate": "2026-07-10",
    "amount": 15
  }' | jq .
```

### Listar avisos de un cliente
```bash
curl -s "http://localhost:3001/api/billing/notices?clientId=22222222-2222-2222-2222-000000000001" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Enviar aviso (cambia status → sent)
```bash
NOTICE_ID="<id_del_aviso>"
curl -s -X POST "http://localhost:3001/api/billing/notices/$NOTICE_ID/send" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Registrar un pago
```bash
curl -s -X POST http://localhost:3001/api/billing/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "22222222-2222-2222-2222-000000000001",
    "hostingServiceId": "33333333-3333-3333-3333-000000000001",
    "periodMonth": 7,
    "periodYear": 2026,
    "amount": 15,
    "method": "transfer",
    "paidAt": "2026-07-03",
    "reference": "TR-20260703-001"
  }' | jq .
```

### Registrar pago y marcar aviso como pagado
```bash
curl -s -X POST http://localhost:3001/api/billing/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "22222222-2222-2222-2222-000000000001",
    "hostingServiceId": "33333333-3333-3333-3333-000000000001",
    "paymentNoticeId": "<id_del_aviso>",
    "periodMonth": 7,
    "periodYear": 2026,
    "amount": 15,
    "method": "transfer",
    "paidAt": "2026-07-03"
  }' | jq .
```

### Marcar pago existente como pagado
```bash
PAYMENT_ID="<id_del_pago>"
curl -s -X POST "http://localhost:3001/api/billing/payments/$PAYMENT_ID/mark-paid" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paidAt": "2026-07-03", "method": "cash"}' | jq .
```

### Listar dominios
```bash
curl -s "http://localhost:3001/api/domains?clientId=22222222-2222-2222-2222-000000000001" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Crear dominio
```bash
curl -s -X POST http://localhost:3001/api/domains \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "22222222-2222-2222-2222-000000000001",
    "domain": "nuevodominio.com.ar",
    "registrar": "NIC.ar",
    "expirationDate": "2027-06-15",
    "annualCost": 500,
    "customerPrice": 800
  }' | jq .
```

### Renovar dominio
```bash
DOMAIN_ID="<id_del_dominio>"
curl -s -X POST "http://localhost:3001/api/domains/$DOMAIN_ID/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newExpirationDate": "2028-06-15",
    "annualCost": 500,
    "customerPrice": 800
  }' | jq .
```

### Crear ticket (como cliente)
Logearse como cliente1@bitlogic.test:
```bash
CLIENT_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente1@bitlogic.test","password":"Cambiar123!"}' | jq -r .accessToken)

curl -s -X POST http://localhost:3001/api/support \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Panel no responde",
    "priority": "high",
    "serviceId": "33333333-3333-3333-3333-000000000001"
  }' | jq .
```

### Listar tickets (cliente ve solo los suyos)
```bash
curl -s "http://localhost:3001/api/support" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq '.data[] | {ticketNumber, subject, status}'
```

### Listar tickets (admin ve todos)
```bash
curl -s "http://localhost:3001/api/support" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

### Agregar mensaje a ticket
```bash
TICKET_ID="<id_del_ticket>"
curl -s -X POST "http://localhost:3001/api/support/$TICKET_ID/messages" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Ya lo intenté reiniciando"}' | jq .
```

### Resolver ticket (staff only)
```bash
curl -s -X POST "http://localhost:3001/api/support/$TICKET_ID/resolve" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Listar tareas
```bash
curl -s "http://localhost:3001/api/tasks?status=pending&priority=urgent" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {title, priority, dueDate}'
```

### Crear tarea
```bash
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Migrar cliente1 a nuevo servidor",
    "description": "Preparar y ejecutar migración",
    "priority": "high",
    "clientId": "22222222-0000-0000-0000-000000000001",
    "serviceId": "33333333-0000-0000-0000-000000000001",
    "dueDate": "2026-06-25"
  }' | jq .
```

### Completar tarea
```bash
TASK_ID="<id_de_la_tarea>"
curl -s -X POST "http://localhost:3001/api/tasks/$TASK_ID/complete" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Reabrir tarea completada
```bash
curl -s -X POST "http://localhost:3001/api/tasks/$TASK_ID/reopen" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Dashboard admin (incluye tareas y tickets)
```bash
curl -s http://localhost:3001/api/dashboard/admin \
  -H "Authorization: Bearer $TOKEN" | jq '{pending: .pendingTasksCount, urgent: .urgentTasksCount, overdue: .overdueTasksCount, upcomingTasks: .upcomingTasks}'
```

### Dashboard admin
```bash
curl -s http://localhost:3001/api/dashboard/admin \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Resumen financiero de un cliente
```bash
curl -s "http://localhost:3001/api/billing/clients/22222222-2222-2222-2222-000000000001/summary" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Centro de cobranzas global
```bash
curl -s http://localhost:3001/api/billing/summary \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Probar el refresh automático desde el frontend

El interceptor en `src/lib/api-client.ts` maneja la renovación automáticamente.
Para verificar que funciona:

1. Reducí `JWT_ACCESS_EXPIRY=30s` en `.env` del backend
2. Logeate en el frontend
3. Esperá 30 segundos sin navegar
4. Hacé cualquier acción (ej: abrir una lista de clientes)
5. En el Network tab del browser deberías ver:
   - Una request a la API que devuelve 401
   - Una request a `POST /api/auth/refresh` (automática)
   - La request original repetida con éxito
6. Restaurá `JWT_ACCESS_EXPIRY=15m` cuando termines

---

## Prueba de Seguridad — Tickets

### Verificar que cliente NO puede enviar clientId falso
```bash
# Cliente1 intenta crear ticket para cliente2
curl -s -X POST http://localhost:3001/api/support \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "22222222-0000-0000-0000-000000000002",
    "subject": "Hack attempt",
    "priority": "low"
  }' | jq .ticketNumber

# El ticket se crea con clientId de cliente1 (ignorando body)
```

### Verificar que cliente NO ve notas internas
```bash
# Admin crea nota interna
TICKET_ID="<id>"
curl -s -X POST "http://localhost:3001/api/support/$TICKET_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Nota interna del staff", "isInternal": true}' | jq .

# Cliente intenta ver ticket
curl -s "http://localhost:3001/api/support/$TICKET_ID" \
  -H "Authorization: Bearer $CLIENT_TOKEN" | jq '.messages[] | select(.is_internal==true)'

# (devuelve vacío — cliente no ve mensajes internos)
```

### Verificar que cliente NO puede forzar isInternal=true
```bash
curl -s -X POST "http://localhost:3001/api/support/$TICKET_ID/messages" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Intento de hack", "isInternal": true}' | jq .is_internal

# (devuelve false — no importa qué mande, siempre será false)
```

### Verificar acceso a ticket de otro cliente
```bash
# Cliente1 intenta ver ticket de cliente2
OTHER_TICKET_ID="<ticket_de_cliente2>"
curl -s "http://localhost:3001/api/support/$OTHER_TICKET_ID" \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# 403 Forbidden
```

---

## Desactivar el selector de rol demo en producción

El selector de rol en el panel de administración usa `import.meta.env.DEV` para ocultarse
automáticamente en builds de producción. No requiere ninguna configuración adicional.

- `npm run dev` → selector visible (para testing de permisos)
- `npm run build` → selector eliminado del bundle automáticamente

---

## Estructura

```
backend/
├── src/
│   ├── app.js                    # Express + middlewares + rutas
│   ├── server.js                 # Entry point: verifica DB y levanta
│   ├── config/index.js           # Variables de entorno centralizadas
│   ├── db/
│   │   └── pool.js               # Pool de conexiones MariaDB (mysql2/promise, único driver)
│   ├── scripts/create-admin.js   # Crea el primer super_admin real (npm run db:create-admin)
│   ├── seeds/
│   │   ├── seed.js                       # Runner: ejecuta todos los seeds en orden
│   │   ├── 001_admin_seed.js             # Usuario admin inicial
│   │   ├── 002_core_hosting_seed.js      # Planes, clientes, servicios demo
│   │   └── 003_billing_seed.js           # Avisos y pagos demo (abril–junio 2026)
│   ├── middlewares/
│   │   ├── authRequired.js       # Valida Bearer JWT en headers
│   │   └── errorHandler.js       # Manejo centralizado de errores
│   ├── routes/
│   │   ├── auth.routes.js        # Rutas + rate limit en /login
│   │   ├── clients.routes.js
│   │   ├── hosting.routes.js
│   │   ├── billing.routes.js     # Avisos, pagos, resúmenes financieros
│   │   ├── dashboard.routes.js   # KPIs y resumen operativo
│   │   └── domains.routes.js     # Dominios (CRUD + renovación)
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── clients.controller.js
│   │   ├── hosting.controller.js
│   │   ├── billing.controller.js
│   │   ├── dashboard.controller.js
│   │   └── domains.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── clients.service.js
│   │   ├── hosting.service.js
│   │   ├── billing.service.js    # Pagos, avisos, summary por cliente, summary global
│   │   ├── dashboard.service.js  # KPIs, vencimientos próximos, clientes con deuda, actividad reciente
│   │   └── domains.service.js    # CRUD, filtros, renovación de dominios
│   └── utils/
│       ├── jwt.js                # Sign/verify JWT
│       └── password.js           # Hash/verify bcrypt
├── db/
│   ├── schema.sql                        # Fuente de verdad del schema (20 tablas)
│   └── archive/postgresql-migrations/    # Migraciones históricas de Postgres (referencia)
├── scripts/apply-mariadb-schema.mjs      # Runner del schema (npm run db:schema:mariadb)
├── .env.example
└── package.json
```

---

## Frontend — configuración

En la raíz del proyecto frontend, creá `.env.local`:

```
VITE_API_BASE_URL=http://localhost:3001/api
```

Este archivo NO debe commitearse (está en `.gitignore` por convención de Vite).
