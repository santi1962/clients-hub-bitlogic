# Bitlogic Client Hub

Sistema interno de Bitlogic (empresa de hosting) para gestionar clientes, servicios de hosting, dominios, facturación/cobranza, soporte y tareas, más un portal separado donde los clientes finales ven sus propios datos y pagan. Uso privado de Bitlogic — no es un producto multi-tenant.

**Documentación vigente:** [`docs/PRODUCTION_STATUS.md`](docs/PRODUCTION_STATUS.md) (estado funcional e integraciones, fuente de verdad) y [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) (guía de deploy). Todo lo que esté en `docs/archive/` es documentación histórica de sesiones de desarrollo anteriores — **no usarla como referencia**, puede estar desactualizada o contradecir el código real.

---

## 📋 Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TanStack Start (SSR) + TanStack Router/Query, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js **>=22.12.0** (ESM), Express, MariaDB 11.4 (SQL directo, sin ORM) — **único motor soportado**, `pg` fue removido del todo. Ver [`docs/MARIADB_MIGRATION.md`](docs/MARIADB_MIGRATION.md) para el historial de la migración |
| **Auth** | JWT (accessToken 15min en memoria + refreshToken httpOnly 30d) |
| **Tiempo real** | Socket.IO (chat de tickets) — requiere backend en 1 sola instancia (fork), nunca cluster |
| **Procesos** | PM2 vía `ecosystem.config.js` (raíz) — `bitlogic-backend` + `bitlogic-frontend`, ambas fork/1 instancia |
| **Gestor de paquetes** | npm (único soportado — ver `packageManager` en `package.json`) |

---

## 🚀 Cómo levantarlo en local

### Frontend

```bash
npm install
cp .env.example .env.local  # opcional, defaults a http://localhost:3001/api
npm run dev  # http://localhost:5173
```

**Variables de entorno** (`.env.local`):
```
VITE_API_BASE_URL=http://localhost:3001/api
```

### Backend

```bash
cd backend
npm install
cp .env.example .env  # REQUERIDO: completar DB (MariaDB), JWT secrets, SMTP, etc.
npm run db:schema:mariadb -- --url mysql://user:pass@host:port/dbname  # Crea el schema (20 tablas)
npm run db:create-admin  # Crea el super_admin real desde ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD
npm run seed:demo -- --yes  # Opcional: datos de DEMO (ver advertencia abajo)
npm start            # http://localhost:3001
```

**Variables de entorno** (`.env`): ver `backend/.env.example` para la lista completa (incluye DB, JWT, SMTP, MercadoPago, Telegram, WhatsApp, admin bootstrap).

**Requisito de Node: `>=22.12.0`** (lo exige `@tanstack/react-start` del frontend; el backend sigue la misma política, una sola versión mínima para todo el repo). Se hace cumplir en dos niveles: `.npmrc` (`engine-strict=true`, tanto en la raíz como en `backend/`) rechaza `npm install`/`npm ci` con un Node más viejo, y `backend/src/utils/assert-node-version.js` (importado como primera línea de `server.js`) corta el arranque con un mensaje claro si el Node del proceso real no cumple, incluso si `node_modules` se copió a un server con un Node del sistema desactualizado.

> ⚠️ **`npm run seed:demo` carga datos de DEMO ficticios (clientes, servicios, pagos de prueba). No ejecutarlo nunca contra la base de datos de producción** (además se niega a correr si `NODE_ENV=production`). La base de producción se crea fresca directamente en MariaDB vía Hestia/phpMyAdmin en el VPS — no hay datos reales que migrar, se parte de cero con `db:schema:mariadb` + `db:create-admin`.

---

## 🗂️ Estructura del repo

```
/                     # Frontend (React + TanStack Start)
├── src/
│   ├── routes/       # Rutas (file-based routing de TanStack Router)
│   ├── components/   # Componentes UI
│   └── lib/          # api-client, queries, mappers, auth, utils
├── backend/          # Backend (Express + MariaDB)
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── db/pool.js        # Pool mysql2/promise (único driver)
│   │   ├── scripts/create-admin.js  # Crea el super_admin real
│   │   └── seeds/            # Seeds de demo, numerados
│   ├── db/
│   │   ├── schema.sql        # Fuente de verdad del schema (20 tablas)
│   │   └── archive/postgresql-migrations/  # Migraciones históricas de Postgres (referencia)
│   ├── scripts/apply-mariadb-schema.mjs  # Runner del schema.sql
│   └── uploads/ / whatsapp-session/ / backups/   # Datos persistentes (ignorados por git)
└── docs/
    ├── PRODUCTION_STATUS.md   # Estado funcional vigente
    ├── SCHEDULER.md           # Automatizaciones: horarios, cron, logs
    └── archive/                # Documentación histórica (no usar como referencia)
```

---

## 📊 Schema y Seeds

`backend/db/schema.sql` es la **única fuente de verdad** del schema (20 tablas, InnoDB, `utf8mb4`/`utf8mb4_unicode_520_ci`). Las 16 migraciones históricas de PostgreSQL quedaron archivadas como referencia no ejecutable en `backend/db/archive/postgresql-migrations/`. Seeds de demo numerados en `backend/src/seeds/`.

```bash
npm run db:schema:mariadb -- --url mysql://user:pass@host:port/dbname  # Crea/actualiza el schema
npm run db:create-admin   # Crea el primer super_admin real (idempotente por email)
npm run seed:demo -- --yes  # Corre todos los seeds de DEMO (nunca en producción)
```

---

## 👥 Usuarios de Prueba (seed de demo)

| Email | Password | Rol |
|-------|----------|-----|
| `admin@bitlogic.com.ar` | `Cambiar123!` | super_admin |
| `cliente1@bitlogic.test` … `cliente4@bitlogic.test` | `Cambiar123!` | cliente |

---

## 📍 Módulos

Estado funcional detallado por módulo (qué está conectado end-to-end, qué depende de una credencial externa pendiente): ver **[`docs/PRODUCTION_STATUS.md`](docs/PRODUCTION_STATUS.md)**. No se mantiene una segunda copia de esa tabla acá para evitar que queden desactualizadas entre sí.

---

## 🔐 Seguridad por Rol

| Recurso | Super Admin | Admin | Soporte | Staff | Cliente |
|---------|-----------|-------|---------|-------|---------|
| `/api/clients` | ✅ | ✅ | ✅ (read) | ✅ (read) | ❌ |
| `/api/tasks` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/api/support` | ✅ | ✅ | ✅ | ✅ | ✅ (propios) |
| `/api/domains` | ✅ | ✅ | ✅ | ✅ | ✅ (propios) |
| `/portal/*` | — | — | — | ❌ (sin `clientId` → redirige) | ✅ (real) |

**Portal cliente**: requiere `user.clientId` (asignado al crear el acceso de portal). Staff sin `clientId` es redirigido a `/clientes` con un aviso — no hay bypass de demo en ningún ambiente.

---

## 📡 API Response Format

**Listas**: `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 100 } }`
**Detalle**: objeto plano `{ "id": "...", ... }`
**Errores**: `{ "error": { "message": "...", "code": "INVALID_REQUEST" } }`

---

## 🛠️ Comandos Útiles

### Frontend
```bash
npm run dev        # dev server con hot reload
npm run build      # build para producción
npm run preview    # preview del build
npm run lint       # ESLint (con --fix)
```

### Backend
```bash
npm run dev        # dev con nodemon
npm start          # servidor en http://localhost:3001
npm run db:schema:mariadb -- --url mysql://...  # crear/actualizar el schema
npm run db:create-admin   # crear el super_admin real
npm run seed:demo -- --yes  # ejecutar seeds de DEMO (no usar en producción)
npm run db:reset   # DESTRUCTIVO: drop+create (requiere --yes, nunca en producción)
npm run clear-demo-data  # borrar datos de demo
npm test           # suite de tests (node:test, sin tráfico ni credenciales reales)
```

---

## 🧪 Tests

```bash
npm run test:backend   # desde la raíz
# o
cd backend && npm test
```

Usa el test runner nativo de Node (`node --test`) — sin Jest/Vitest ni otras dependencias nuevas. Ver [`docs/TESTING.md`](docs/TESTING.md) para qué cubre, qué mockea y qué no cubre todavía.

---

## 📞 Soporte

- Estado funcional e integraciones: [`docs/PRODUCTION_STATUS.md`](docs/PRODUCTION_STATUS.md)
- Automatizaciones/scheduler: [`docs/SCHEDULER.md`](docs/SCHEDULER.md)
- Tests del backend: [`docs/TESTING.md`](docs/TESTING.md)
- Deploy: [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)
- Documentación histórica (no vigente): `docs/archive/`
