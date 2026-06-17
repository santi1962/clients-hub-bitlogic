# Bitlogic Client Hub

SaaS portal para gestión integral de hosting, dominios, pagos y soporte. Stack: React 19 + TanStack + Tailwind CSS + Node.js + Express + PostgreSQL.

---

## 📋 Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js 18+, Express, PostgreSQL 13+ |
| **Auth** | JWT (accessToken 15min + httpOnly refreshToken 30d) |
| **Queries** | React Query with optimistic updates |
| **API** | REST con response format consistente |

---

## 🚀 Instalación

### Frontend

```bash
cd .  # ya en raíz del proyecto
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
cp .env.example .env  # REQUERIDO para DB y JWT secrets
npm run migrate      # Ejecuta migraciones en orden
npm run seed         # Inserta datos iniciales (idempotente)
npm start            # http://localhost:3001
```

**Variables de entorno** (`.env`):
```
DATABASE_URL=postgresql://user:pass@localhost:5432/bitlogic
JWT_ACCESS_SECRET=<generar: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<generar: mismo comando, diferente valor>
CORS_ORIGIN=http://localhost:5173
PORT=3001
NODE_ENV=development
```

---

## 📊 Migraciones y Seeds (Orden)

| # | Migración | Seed | Datos |
|---|-----------|------|-------|
| 1 | `001_auth_schema.sql` | `001_admin_seed.js` | Admin user |
| 2 | `002_core_hosting_schema.sql` | `002_core_hosting_seed.js` | Clientes, planes, servicios |
| 3 | `003_billing_schema.sql` | `003_billing_seed.js` | Pagos, avisos |
| 4 | `004_domains_schema.sql` | `004_domains_seed.js` | 12 dominios |
| 5 | `005_support_schema.sql` | `005_support_seed.js` | 5 tickets |
| 6 | — | `006_client_users_seed.js` | 4 usuarios cliente |
| 6 | `006_tasks_schema.sql` | `007_tasks_seed.js` | 12 tareas |

**Ejecutar**:
```bash
npm run migrate  # corre todas las migraciones en orden
npm run seed     # corre todos los seeds (idempotente, ON CONFLICT DO NOTHING)
```

---

## 👥 Usuarios de Prueba

### Staff

| Email | Password | Rol |
|-------|----------|-----|
| `admin@bitlogic.com.ar` | `Cambiar123!` | super_admin |

### Clientes

| Email | Password | Rol | ClientId |
|-------|----------|-----|----------|
| `cliente1@bitlogic.test` | `Cambiar123!` | cliente | `222...0001` |
| `cliente2@bitlogic.test` | `Cambiar123!` | cliente | `222...0002` |
| `cliente3@bitlogic.test` | `Cambiar123!` | cliente | `222...0003` |
| `cliente4@bitlogic.test` | `Cambiar123!` | cliente | `222...0004` |

---

## 📍 Módulos Reales (Backend + Frontend)

### Conectados (100%)

| Módulo | Backend | Frontend | Portal |
|--------|---------|----------|--------|
| **Auth** | ✅ JWT + refresh | ✅ | ✅ |
| **Clientes** | ✅ CRUD + filtros | ✅ tabla + detalle | — |
| **Planes** | ✅ list | ✅ select | — |
| **Servicios** | ✅ CRUD + cambiar plan | ✅ tabla + detalle | ✅ lista |
| **Dominios** | ✅ CRUD + renovar | ✅ tabla + detalle | ✅ lista |
| **Pagos** | ✅ registrar + marcar pagado | ✅ tabla + resumen | ✅ lista |
| **Avisos** | ✅ CRUD + generar + enviar | ✅ tabla + detalle | ✅ lista |
| **Tickets** | ✅ CRUD + mensajes + resolve/close | ✅ tabla + detalle | ✅ lista |
| **Tareas** | ✅ CRUD + complete/reopen | ✅ tabla + detalle | — |
| **Dashboard** | ✅ admin KPIs | ✅ | — |

### Aún en Mock

| Módulo | Estado |
|--------|--------|
| **Tareas (portal cliente)** | Mock (staff-only en backend) |
| **Automatizaciones** | Mock |
| **Notificaciones** | Mock |
| **Email real** | Mock (placeholder en seed) |
| **Chat en tiempo real** | Mock (no WebSocket) |

---

## 🔐 Seguridad por Rol

| Recurso | Super Admin | Admin | Soporte | Staff | Cliente |
|---------|-----------|-------|---------|-------|---------|
| `/api/clients` | ✅ | ✅ | ✅ (read) | ✅ (read) | ❌ |
| `/api/tasks` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/api/support` | ✅ | ✅ | ✅ | ✅ | ✅ (propios) |
| `/api/domains` | ✅ | ✅ | ✅ | ✅ | ✅ (propios) |
| `/portal/*` | ✅ (demo) | ✅ (demo) | ✅ (demo) | ✅ (demo) | ✅ (real) |

**Portal cliente**:
- Cliente debe tener `user.clientId`
- Ve solo datos propios
- Staff sin `clientId` en PROD → denegado (DEMO_CLIENT_ID solo en DEV)

---

## 🧪 Validaciones Backend Implementadas

- ✅ Email válido en auth
- ✅ Montos positivos en pagos
- ✅ Fechas válidas
- ✅ Status válidos (enum CHECK)
- ✅ Relaciones existentes (FK)
- ✅ No crear servicio para cliente inactivo
- ✅ No crear aviso para servicio cancelado
- ✅ No registrar pago <= 0
- ✅ Soft delete (status → cancelled)
- ✅ Ticket numbers únicos (secuencia SQL)

---

## 📡 API Response Format

### Listas
```json
{
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

### Detalle
```json
{
  "id": "...",
  "name": "...",
  ...
}
```

### Errores
```json
{
  "error": {
    "message": "...",
    "code": "INVALID_REQUEST"
  }
}
```

---

## 🛠️ Comandos Útiles

### Frontend
```bash
npm run dev        # dev server con hot reload
npm run build      # build para producción
npm run build:dev  # build en modo desarrollo
npm run preview    # preview del build
npm run lint       # ESLint (con --fix)
```

### Backend
```bash
npm run migrate    # ejecutar migraciones
npm run seed       # ejecutar seeds
npm start          # servidor en http://localhost:3001
npm run dev        # dev con nodemon
npm run lint       # ESLint
```

---

## 📋 Checklist de Desarrollo

### Antes de hacer merge a main

- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin errores críticos
- [ ] Backend `npm run migrate && npm run seed` desde DB vacía
- [ ] Frontend loguea como admin y cliente
- [ ] Portal cliente accede con clientId real
- [ ] Invalidaciones de React Query funcionan
- [ ] Loading/error/empty states en todas las páginas
- [ ] Toasts en mutations
- [ ] Roles y permisos correctos

---

## 🚨 Estado Conocido

### Problemas Solucionados (Fase 4A)

✅ Frontend build sin TypeScript errors
✅ Backend migrations y seeds idempotentes
✅ Seguridad de roles verificada
✅ Portal cliente sin DEMO_CLIENT_ID en PROD
✅ API consistency (meta format)
✅ Validaciones backend implementadas

### Pendientes para Fases Futuras

- Integraciones externas: Hestia CP, MercadoPago, PayPal
- Email real (SendGrid/Resend)
- Chat en tiempo real (WebSocket)
- Automatizaciones con workflows
- Notificaciones push/browser

---

## 📞 Support

- **Backend README**: [backend/README.md](backend/README.md)
- **Frontend package.json**: scripts disponibles
- **Bugs/Issues**: Crear en GitHub con contexto completo

---

**Última actualización:** Fase 4A (Hardening General)  
**Stack verificado:** ✅ Build + Lint + Migrations + Seeds + Security + API Consistency
