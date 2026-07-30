# Bitlogic Client Hub

Sistema interno de Bitlogic (empresa de hosting) para gestionar clientes, servicios de hosting, dominios, facturación/cobranza, soporte y tareas, más un portal separado donde los clientes finales ven sus propios datos y pagan. Uso privado de Bitlogic — no es un producto multi-tenant.

**Documentación vigente:** [`docs/PRODUCTION_STATUS.md`](docs/PRODUCTION_STATUS.md) (estado funcional e integraciones, fuente de verdad) y [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) (guía de deploy). Todo lo que esté en `docs/archive/` es documentación histórica de sesiones de desarrollo anteriores — **no usarla como referencia**, puede estar desactualizada o contradecir el código real.

---

## 📋 Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TanStack Start (SSR) + TanStack Router/Query, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js 18+ (ESM), Express, PostgreSQL (SQL directo, sin ORM). Motor activo hoy; el código de aplicación ya es 100% ejecutable contra MariaDB también (capa dual `pg`/`mysql2`), ver [`docs/MARIADB_MIGRATION.md`](docs/MARIADB_MIGRATION.md) — todavía no se migraron datos reales ni se cambió el motor de producción |
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
cp .env.example .env  # REQUERIDO: completar DB, JWT secrets, SMTP, etc.
npm run migrate      # Ejecuta migraciones en orden
npm run seed         # Inserta datos de DEMO (ver advertencia abajo)
npm start            # http://localhost:3001
```

**Variables de entorno** (`.env`): ver `backend/.env.example` para la lista completa (incluye DB, JWT, SMTP, MercadoPago, Telegram, WhatsApp).

> ⚠️ **`npm run seed` carga datos de DEMO ficticios (clientes, servicios, pagos de prueba). No ejecutarlo nunca contra la base de datos de producción.** Para producción, la base real se migra con `pg_dump`/`pg_restore`, no se siembra desde cero.

---

## 🗂️ Estructura del repo

```
/                     # Frontend (React + TanStack Start)
├── src/
│   ├── routes/       # Rutas (file-based routing de TanStack Router)
│   ├── components/   # Componentes UI
│   └── lib/          # api-client, queries, mappers, auth, utils
├── backend/          # Backend (Express + PostgreSQL)
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── migrations/       # Migraciones SQL numeradas
│   │   ├── db/migrate.js     # Runner de migraciones
│   │   └── seeds/            # Seeds de demo, numerados
│   └── uploads/ / whatsapp-session/ / backups/   # Datos persistentes (ignorados por git)
└── docs/
    ├── PRODUCTION_STATUS.md   # Estado funcional vigente
    ├── SCHEDULER.md           # Automatizaciones: horarios, cron, logs
    └── archive/                # Documentación histórica (no usar como referencia)
```

---

## 📊 Migraciones y Seeds

Migraciones SQL numeradas en `backend/src/migrations/` (001 a 016 — auth, hosting, billing, dominios, soporte, tareas, email logs, auditoría, scheduler, automatizaciones, settings, notificaciones, plantillas de email, backups, reset de contraseña). Se ejecutan en orden numérico y son idempotentes (`CREATE TABLE IF NOT EXISTS`, etc.). Seeds de demo numerados en `backend/src/seeds/`.

```bash
npm run migrate  # corre todas las migraciones en orden (idempotentes)
npm run seed     # corre todos los seeds de DEMO (idempotente, ON CONFLICT DO NOTHING)
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
npm run migrate    # ejecutar migraciones
npm run seed       # ejecutar seeds de DEMO (no usar en producción)
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
