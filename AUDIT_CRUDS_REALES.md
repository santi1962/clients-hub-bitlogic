# AUDIT DE CRUDs REALES — Bitlogic Client Hub

**Fecha:** 2026-06-18  
**Objetivo:** Verificar que todos los CRUDs estén completos antes de cargar datos reales

---

## 1️⃣ MÓDULO: CLIENTES

### Backend Endpoints

**Controlador:** `backend/src/controllers/clients.controller.js`

Funciones implementadas:
- ✅ `list()` — GET con pagination y filtros
- ✅ `get()` — GET por ID
- ✅ `create()` — POST con validación
- ✅ `update()` — PATCH
- ✅ `remove()` — DELETE (soft delete)

**Rutas:** `backend/src/routes/clients.routes.js`

Expected:
```
GET    /api/clients
GET    /api/clients/:id
POST   /api/clients
PATCH  /api/clients/:id
DELETE /api/clients/:id
```

**Status:** ✅ Controlador completo

### Frontend Components

**Location:** `src/routes/_admin.clientes.tsx` (si existe)

Componentes necesarios:
- [ ] Listado de clientes (tabla con paginación)
- [ ] Crear cliente (formulario)
- [ ] Editar cliente (formulario)
- [ ] Ver detalle
- [ ] Activar/Desactivar

**Status:** ⚠️ **Requiere verificación**

### Validaciones

Backend esperadas:
- ✅ company requerido
- ✅ email válido
- ✅ status check (active/inactive)
- ✅ Audit logging

**Status:** ✅ Parece completo

### Readiness

Cuenta: `WHERE status = 'active'`

**Status:** ✅ Detectado en /api/settings/readiness

---

## 2️⃣ MÓDULO: SERVICIOS (Hosting)

### Backend Endpoints

**Controlador:** `backend/src/controllers/hosting.controller.js`

Funciones implementadas:
- ✅ `listServices()` — GET con filtros
- ✅ `getService()` — GET por ID
- ✅ `createService()` — POST
- ✅ `updateService()` — PATCH
- ✅ `suspendService()` — POST /suspend
- ✅ `reactivateService()` — POST /reactivate
- ✅ `changePlan()` — POST /plan
- ✅ `syncHestia()` — POST /sync

**Rutas:** `backend/src/routes/hosting.routes.js`

Expected:
```
GET    /api/hosting/services
GET    /api/hosting/services/:id
POST   /api/hosting/services
PATCH  /api/hosting/services/:id
POST   /api/hosting/services/:id/suspend
POST   /api/hosting/services/:id/reactivate
POST   /api/hosting/services/:id/plan
POST   /api/hosting/services/:id/sync
```

**Status:** ✅ Controlador muy completo

### Frontend Components

**Location:** `src/routes/_admin.servicios.tsx` (si existe)

Componentes necesarios:
- [ ] Listado de servicios (tabla)
- [ ] Crear servicio (formulario con cliente + plan dropdown)
- [ ] Editar servicio
- [ ] Ver detalle
- [ ] Botones: Suspender, Reactivar, Cambiar Plan
- [ ] Sincronizar Hestia

**Status:** ⚠️ **Requiere verificación**

### Validaciones

Backend esperadas:
- ✅ client_id requerido (FK)
- ✅ plan_id requerido (FK)
- ✅ domain requerido
- ✅ monthly_price > 0
- ✅ next_due_date requerido
- ✅ status check

**Status:** ⚠️ **Parece completo pero requiere verificación de validaciones**

### Readiness

Cuenta: `WHERE status = 'active'`

**Status:** ✅ Detectado en /api/settings/readiness

---

## 3️⃣ MÓDULO: USUARIOS PORTAL

### Backend Endpoints

**Controlador:** Revisar si existe en `backend/src/controllers/`

Expected endpoints:
```
GET    /api/users
GET    /api/users/:id
POST   /api/users/client  ← Crear usuario cliente
PATCH  /api/users/:id
POST   /api/users/:id/password-reset
POST   /api/users/:id/toggle-status
```

**Status:** ⚠️ **Requiere verificación**

**Verificando...**

### Frontend Components

**Location:** `src/routes/_admin.usuarios.tsx` o similar

Componentes necesarios:
- [ ] Listado de usuarios (tabla)
- [ ] Crear usuario cliente (formulario)
- [ ] Editar usuario
- [ ] Reset password
- [ ] Activar/Desactivar
- [ ] Vincular client_id

**Status:** ⚠️ **Requiere verificación**

### Validaciones

Backend esperadas:
- [ ] email válido
- [ ] client_id requerido (FK)
- [ ] password segura (mín 8 caracteres)
- [ ] email unique
- [ ] No duplicar email

**Status:** ⚠️ **Requiere verificación**

### Readiness

Cuenta: `WHERE role = 'cliente' AND status = 'active'`

**Status:** ✅ Detectado en /api/settings/readiness

---

## 4️⃣ MÓDULO: DOMINIOS

### Backend Endpoints

**Rutas:** `backend/src/routes/domains.routes.js`

Expected:
```
GET    /api/domains
GET    /api/domains/:id
POST   /api/domains
PATCH  /api/domains/:id
```

**Status:** ⚠️ **Requiere verificación**

### Frontend Components

**Status:** ⚠️ **Requiere verificación**

### Validaciones

- [ ] cliente requerido
- [ ] domain requerido
- [ ] expiration_date requerido

---

## 5️⃣ READINESS (Dashboard)

### GET /api/settings/readiness

Requisitos detectados:
```
✅ companyConfigured      — Verificado
✅ activePlansExist       — Verificado
✅ realClientsExist       — Verificado
✅ realServicesExist      — Verificado
✅ domainsExist           — Verificado
✅ portalUsersExist       — Verificado
❓ smtpConfigured         — .env
❓ hestiaConfigured       — .env
```

**Status:** ✅ Lógica implementada

---

## 📋 RESUMEN POR MÓDULO

| Módulo | Controlador | Rutas | Frontend | Validaciones | Status |
|--------|-------------|-------|----------|--------------|--------|
| **Clientes** | ✅ Sí | ✅ Existen | ⚠️ Verificar | ✅ Sí | ⚠️ Parcial |
| **Servicios** | ✅ Sí | ✅ Existen | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Parcial |
| **Usuarios** | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Verificar | ❌ Falta |
| **Dominios** | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Verificar | ⚠️ Parcial |

---

## 🔍 PRÓXIMOS PASOS DE VERIFICACIÓN

1. **Revisar rutas en app.js:**
   - ¿Están habilitadas `/api/clients`, `/api/hosting/services`, `/api/domains`, `/api/users`?

2. **Revisar frontend:**
   - ¿Existen componentes para ver, crear, editar clientes?
   - ¿Existen componentes para ver, crear, editar servicios?
   - ¿Existen componentes para crear usuarios cliente?

3. **Revisar servicios:**
   - ¿Tienen lógica completa de validación?
   - ¿Tienen queries parametrizadas?
   - ¿Tienen manejo de errores?

4. **Revisar controladores usuarios:**
   - ¿Existen?
   - ¿Está la lógica de create con client_id?
   - ¿Está la validación de email unique?

---

## 📌 NOTAS

- **App.js actual:** Solo tiene settings + plans + auth login
- **Rutas disponibles:** Existen archivos, pero no están habilitadas en app.js
- **Frontend:** Requiere verificación en secciones admin

---

**Status:** ⚠️ **REQUIERE AUDIT DETALLADO**

Siguiente: Verificar app.js, frontend routes, y servicios backend.

