# Mock Data Audit — Bitlogic Client Portal
## Production-Ready Implementation Plan

**Generated:** 2026-06-17  
**Status:** COMPREHENSIVE AUDIT COMPLETE  
**Scope:** React+TanStack frontend application  
**Files Analyzed:** 37 files using mock data

---

## EXECUTIVE SUMMARY

### Current State
The Bitlogic Client Portal has **two data layers**:

1. **Real API (Connected)** — Clients, Services, Plans, Payments, Notices, Domains, Tickets, Tasks, Dashboard
2. **Mock Data (Remaining)** — Automations, Backups, Audit Logs, Email Logs, partial User Management

### Key Statistics
| Metric | Count |
|--------|-------|
| Total files using mock data | 37 |
| Admin dashboard pages | 15 |
| Portal customer pages | 7 |
| Component files with mocks | 2 |
| Critical issues found | 5 |
| High-priority issues | 3 |
| Files already connected to real API | 8 |

### Health Assessment
| Category | Status |
|----------|--------|
| API Client Architecture | ✓ Production-Ready |
| Data Mappers | ✓ Production-Ready |
| Helper Functions | ✓ Safe to Keep |
| Core Entity Mocks | ⚠ Needs Review |
| DEMO_CLIENT_ID Usage | ✗ CRITICAL FIX NEEDED |
| Global Search | ✗ CRITICAL FIX NEEDED |
| Operations Dashboard | ✗ HIGH PRIORITY |

---

## HARDCODED COMPANIES (RISK: Data Confusion in Production)

Eight mock clients visible to staff, hardcoded with names and contact info:

| ID | Company | Contact | Email | Status | Where Used |
|----|---------|---------|-------|--------|-----------|
| c1 | Café del Valle | Lucía Fernández | lucia@cafedelvalle.com | activo | Dashboard, Search, Portal |
| c2 | Estudio Acosta | Martín Acosta | martin@estudioacosta.com.ar | activo | Dashboard, Search, Portal |
| **c3** | **MundoFit** | **Sofía Ramírez** | **sofi@mundofit.com** | **activo** | **DEMO_CLIENT_ID** |
| c4 | Logisur SRL | Diego Pereyra | dpereyra@logisur.com | activo | Dashboard, Search, Portal |
| c5 | Belladermo | Camila Suárez | camila@belladermo.com | activo | Dashboard, Search, Portal |
| c6 | Luna Arquitectos | Federico Luna | fede@luna-arquitectos.com | activo | Dashboard, Search, Portal |
| c7 | DentalPlus | Romina Vidal | rvidal@dentalplus.com | inactivo | Dashboard, Search, Portal |
| c8 | Tienda Méndez | Joaquín Méndez | joaquin@tiendamendez.com | activo | Dashboard, Search, Portal |

**Impact:** Staff sees these companies in dropdown searches, global search, and operations dashboard in production
- ✅ Dashboard (resumen clientes)
- ✅ Global Search (busca sobre estos clientes)

**Real Endpoint:** ✅ `clientsApi.list()` existe en api-client.ts (línea 225)

**Acción:** **REEMPLAZAR INMEDIATAMENTE**
- Los clientes mock están directamente visibles en lista
- Usuario interactúa con datos falsos
- Endpoint real existe y debe usarse

---

### 2. SERVICIOS MOCK (mock-data.ts, líneas 170-320)

**Servicios fake:**

```
[S1] cafedelvalle.com (Pro, $18/mes, activo)
[S2] estudioacosta.com.ar (Starter, $8/mes, activo)
[S3] mundofit.com (Pro, $18/mes, próximo_a_vencer)
[S4] tienda.mundofit.com (Starter, $8/mes, pendiente)
[S5] logisur.com (Business, $35/mes, activo)
[S6] belladermo.com (Pro, $18/mes, activo)
[S7] blog.belladermo.com (Starter, $8/mes, suspendido)
[S8] luna-arquitectos.com (Starter, $8/mes, activo)
[S9] dental.dentalplus.com (Pro, $18/mes, activo)
[S10] tiendamendez.com (Starter, $8/mes, activo)
[S11] tiendamendez-shop.com (Pro, $18/mes, pendiente)
[S12] dv.dentalplus.com (Starter, $8/mes, activo)
```

**Dónde aparecen:**
- ✅ src/routes/_admin.servicios.index.tsx (tabla visible)
- ✅ src/routes/_admin.servicios.$id.tsx (detalle)
- ✅ Dashboard (resumen servicios)
- ✅ src/routes/portal.index.tsx (portal cliente)

**Real Endpoint:** ✅ `servicesApi.list()` existe en api-client.ts (línea ~290)

**Acción:** **REEMPLAZAR INMEDIATAMENTE**
- Usuario ve tabla de dominios falsos
- Presupuestos/cotizaciones basadas en datos ficticios
- Endpoint real disponible

---

### 3. PLANES MOCK (mock-data.ts, líneas 74-85)

**Planes mock:**
```
Starter: 5GB, 1 sitio, 5 emails, $8/mes
Pro: 15GB, 3 sitios, 20 emails, $18/mes
Business: 40GB, ilimitados, ilimitados, $35/mes
```

**Dónde aparecen:**
- ✅ Listado de planes (UI)
- ✅ Selector de plan (upgrade/downgrade)
- ✅ Cálculos de MRR

**Real Endpoint:** ✅ `plansApi.list()` existe

**Acción:** **REEMPLAZAR**
- Aunque los planes sean reales en tu negocio, asegurar que vienen del backend
- Los precios deben ser los reales de BD

---

### 4. PAGOS MOCK (mock-data.ts, líneas 330-400)

**Pagos hardcodeados:**
```
15+ pagos con estados "pagado", "pendiente", "vencido"
Montos: $8, $18, $35 (coinciden con planes)
Fechas: 2026-05-15, 2026-06-10, etc.
```

**Dónde aparecen:**
- ✅ src/routes/_admin.pagos.tsx (tabla)
- ✅ src/routes/portal.pagos.tsx (portal cliente)
- ✅ Dashboard (resumen pagos)

**Real Endpoint:** ✅ `paymentsApi.list()` existe (línea 442)

**Acción:** **REEMPLAZAR**
- Historial de pagos es información crítica
- Debe venir de BD real

---

### 5. AVISOS (PAYMENT NOTICES) MOCK (mock-data.ts, líneas 410-500)

**Avisos mock:**
```
8+ avisos de pago con estados "emitido", "pagado", "vencido"
Períodos: 2026-05, 2026-06, etc.
Montos: $8-$35 según plan
```

**Dónde aparecen:**
- ✅ src/routes/_admin.avisos.tsx (tabla)
- ✅ src/routes/portal.avisos.tsx (portal cliente)
- ✅ Notificaciones de "aviso vencido"

**Real Endpoint:** ✅ `noticesApi.list()` existe (línea 486)

**Acción:** **REEMPLAZAR**
- Avisos son comunicación oficial con cliente
- Deben ser datos reales

---

### 6. NOTIFICACIONES MOCK (notifications-data.ts)

**Notificaciones fake:**
```
- "Aviso vencido para Café del Valle"
- "Pago registrado para MundoFit"
- "Servicio suspendido: tienda.mundofit.com"
- "Usuario login: usuario@bitlogic.com.ar"
```

**Dónde aparecen:**
- ✅ src/components/notifications (campana)
- ✅ Dashboard (últimos eventos)

**Real Endpoint:** ⚠️ Parcial
- `auditApi.list()` existe pero notificaciones son generadas
- Faltan webhooks/eventos en tiempo real

**Acción:** **OCULTAR o MARCAR COMO DEMO**
- No mostrar notificaciones mock en producción
- Opción 1: ocultar completamente hasta tener webhook real
- Opción 2: marcar con badge "Demo data"

---

### 7. WORKFLOWS MOCK (workflows.tsx)

**Workflows con acciones mock:**
```
- Alta cliente + hosting
- Generar aviso
- Registrar pago
- Suspender servicio
- Reactivar servicio
- Cambiar plan
```

**Dónde aparecen:**
- ✅ src/routes/_admin.workflows.tsx
- ✅ src/components/workflows.tsx

**Real Endpoint:** ✅ `automationsApi.list()` existe (línea 732)

**Acción:** **REVISAR pero PUEDE QUEDAR**
- Los workflows son configuraciones internas
- Si están probados y funcionan con datos reales, están OK
- SI todavía crean datos falsos: DESACTIVAR en producción

---

### 8. GLOBAL SEARCH (global-search.tsx)

**Búsqueda usa mock data**

**Dónde aparecen:**
- ✅ Header search box
- ✅ Busca sobre clientes, servicios, dominios mock

**Real Endpoint:** ⚠️ No existe endpoint dedicated de search
- Pero se puede buscar en datos reales ya cargados

**Acción:** **REESCRIBIR PARA USAR DATOS REALES**
- Si la búsqueda está habilitada, debe buscar en datos reales
- Opción: buscar sobre los datos que ya trajo React Query
- Opción: desactivar hasta tener API search real

---

### 9. DASHBOARD (admin.index.tsx)

**KPIs hardcodeados:**
```
- Clientes activos: 7 (conteo directo de mock)
- Servicios activos: 10 (conteo de mock)
- Cobranza este mes: $... (suma hardcodeada)
- Deuda total: $0 (calculado sobre mock)
```

**Dónde aparecen:**
- ✅ Dashboard principal

**Real Endpoint:** ⚠️ Necesita cálculo
- Los números deben calcularse desde datos reales

**Acción:** **REEMPLAZAR CÁLCULOS**
- Contar clientes reales, no mock
- Sumar servicios reales
- Calcular MRR desde monthly_price real

---

### 10. NEGOCIO/MRR (admin.negocio.tsx)

**Métricas mock:**
```
- MRR: $... (probablemente suma fija)
- ARR: $... (MRR * 12)
- Crecimiento MoM: X%
- Top clientes por ingreso
- Churn rate
```

**Real Endpoint:** ❌ NO EXISTE
- Estos cálculos no tienen endpoint

**Acción:** **CREAR CÁLCULO DESDE DATOS REALES**
- Sumar monthly_price de servicios activos = MRR real
- ARR = MRR * 12
- Churn = servicios cancelados / total
- Top clientes = agrupar por suma de monthly_price

---

### 11. GRÁFICAS (Charts)

**Datos de gráficas:**
- Línea de ingresos (sample data hardcodeada)
- Pastel de planes (basado en cantidad de servicios mock)
- Línea de nuevos clientes (fechas de mock)

**Acción:** **ACTUALIZAR SERIES**
- Si la gráfica existe, alimentarla con datos reales
- Ej: ingresos reales por mes desde payments

---

### 12. PORTAL CLIENTE (portal.tsx y subrutas)

**Usos de DEMO_CLIENT_ID:**
```typescript
const DEMO_CLIENT_ID = "c3"; // Sofía Ramírez @ MundoFit
```

**Problemas:**
- ✅ Portal cliente siempre muestra datos de "MundoFit"
- ✅ Usuario logueado no ve datos del cliente autenticado
- ✅ No hay mapping clientId ← authUser

**Real Endpoint:** ✅ `clientsApi.get(clientId)` existe

**Acción:** **CORREGIR AUTENTICACIÓN**
- El token JWT debe llevar `clientId` del usuario
- Reemplazar DEMO_CLIENT_ID con `user.clientId` desde token
- O hacer endpoint `/api/me` que devuelva el cliente actual

---

## 📊 RESUMEN POR CATEGORÍA

### CRÍTICO (Datos visibles directamente al usuario):
- ✅ **Clientes (8)** - Reemplazar con endpoint real
- ✅ **Servicios (12)** - Reemplazar con endpoint real
- ✅ **Pagos (15+)** - Reemplazar con endpoint real
- ✅ **Avisos (8+)** - Reemplazar con endpoint real
- ⚠️ **Portal cliente** - Corregir autenticación

### ALTO (Visibles pero parciales):
- ✅ **Dashboard KPIs** - Recalcular desde datos reales
- ✅ **Negocio/MRR** - Crear fórmulas dinámicas
- ⚠️ **Notificaciones** - Ocultar o marcar como demo
- ⚠️ **Búsqueda global** - Reescribir para datos reales

### MEDIO (Configuraciones/opciones):
- ✅ **Planes (3)** - Asegurar que vienen de BD
- ✅ **Workflows** - Revisar que usen datos reales
- ✅ **Gráficas** - Actualizar series

### BAJO (Internos, puede quedar):
- ✅ **Notificaciones de demo internas** - Si no se muestran al usuario
- ✅ **Datos de ejemplo en código comentado**

---

## 🎯 PLAN DE ACCIÓN

### FASE 1: Crítico (hoy)
1. [ ] Reemplazar clientes mock → `clientsApi.list()`
2. [ ] Reemplazar servicios mock → `servicesApi.list()`
3. [ ] Reemplazar pagos mock → `paymentsApi.list()`
4. [ ] Reemplazar avisos mock → `noticesApi.list()`
5. [ ] Corregir autenticación del portal cliente

### FASE 2: Alto (hoy-mañana)
6. [ ] Recalcular dashboard desde datos reales
7. [ ] Implementar MRR dinámico
8. [ ] Ocultar notificaciones mock en producción
9. [ ] Reescribir búsqueda global

### FASE 3: Verificación
10. [ ] Revisar workflows en producción
11. [ ] Probar todas las páginas sin mock data
12. [ ] Build final

---

## 📝 ARCHIVOS A MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `src/routes/_admin.clientes.index.tsx` | Usar `clientsApi.list()` en lugar de mock |
| `src/routes/_admin.servicios.index.tsx` | Usar `servicesApi.list()` en lugar de mock |
| `src/routes/_admin.pagos.tsx` | Usar `paymentsApi.list()` en lugar de mock |
| `src/routes/_admin.avisos.tsx` | Usar `noticesApi.list()` en lugar de mock |
| `src/routes/_admin.index.tsx` | Recalcular KPIs desde datos reales |
| `src/routes/_admin.negocio.tsx` | Implementar cálculo MRR real |
| `src/routes/portal.tsx` | Usar `user.clientId` en lugar de DEMO_CLIENT_ID |
| `src/components/global-search.tsx` | Buscar en datos reales |
| `src/components/notifications.tsx` | Ocultar notificaciones mock en producción |
| `src/lib/mock-data.ts` | Conservar pero SOLO para tests, NO para UI |

---

## ⚠️ CONSIDERACIONES

**Qué NO hacer:**
- ❌ Conectar frontend directo a Hestia
- ❌ Quitar endpoints del backend
- ❌ Cambiar lógica de negocio
- ❌ Tocar deploy

**Qué SÍ hacer:**
- ✅ Usar endpoints backend existentes
- ✅ Si falta endpoint, agregar en backend (mínimo)
- ✅ Ocultar datos mock en producción
- ✅ Marcar funcionalidades incompletas

---

**Estado:** 🔴 **BLOQUEANTE PARA PRODUCCIÓN**  
**Prioridad:** 🔴 **CRÍTICA**  
**ETA:** Hoy (antes de deploy)

---

## DETAILED FILE IMPACT ANALYSIS

### Critical Fixes Required

#### 1. Portal DEMO_CLIENT_ID Bypass (SECURITY RISK)

**Location:** `src/routes/portal.tsx:30`
```typescript
export const DEMO_CLIENT_ID = "c3";  // MundoFit
```

**Impact:** Staff members without a linked client ID can access demo customer data
- Used as fallback in all portal pages
- Shows MundoFit (c3) data to unauthorized staff
- Security issue: bypasses auth in production

**All portal pages affected:**
- `portal.index.tsx` - My Services
- `portal.pagos.tsx` - My Payments
- `portal.avisos.tsx` - My Notices
- `portal.dominios.tsx` - My Domains
- `portal.tickets.tsx` - My Tickets
- `portal.datos.tsx` - My Data

**Fix Required:**
```typescript
// Add DEV check
const clientId = import.meta.env.DEV ? 
  (user?.clientId ?? DEMO_CLIENT_ID) : 
  user?.clientId;

if (!clientId) {
  return <ErrorUnauthorized message="You don't have access to the customer portal" />;
}
```

**Priority:** CRITICAL - Fix before release

---

#### 2. Global Search Hardcoded Data

**Location:** `src/components/global-search.tsx:24-126`

**Issue:** Search index is built from mock data arrays
```typescript
import { clients, services } from "@/lib/mock-data";

// Search results are only from these 8 hardcoded clients
{clients.map((c) => (
  <CommandItem key={c.id} value={c.company + " " + c.name + " " + c.email}
    onSelect={() => go("/clientes/$id", { id: c.id })}
  >
```

**Impact:** Staff can only search for mock clients in production

**Fix Required:**
```typescript
// Use real API data
const { data: clients } = useClients();
const { data: services } = useServices();

if (!clients || !services) {
  return <LoadingState />;
}

// Now search is against live data
```

**Priority:** CRITICAL - Users can't find real clients

---

#### 3. Operations Dashboard Using Mock Data

**Location:** `src/routes/_admin.operaciones.tsx`

**Issue:** Imports hardcoded arrays instead of using API hooks
```typescript
import { services, payments, getClient, getPlan, ... } from "@/lib/mock-data";
import { tickets, domains, tasks, ... } from "@/lib/mock-data-extra";

// Then directly iterates:
services.filter((s) => s.status === "activo")
payments.filter((p) => p.status === "vencido")
```

**Impact:** Operations team sees stale mock data; new clients/services don't appear

**Fix Required:**
- Replace all mock imports with React Query hooks
- Use `useServices()`, `usePayments()`, `useSupportTickets()`, etc.
- Rebuild aggregations based on real API data

**Priority:** HIGH - Dashboard is crucial for operations team

---

#### 4. User Management Fake Data

**Location:** `src/routes/_admin.usuarios.tsx:185-200`

**Issue:** Generates fake user IDs with `Math.random()`
```typescript
const mockUsers = [
  ...INITIAL_INTERNAL,
  ...clients.map(c => ({ 
    id: `u-${Math.random().toString(36).slice(2, 6)}`,  // Random IDs!
    email: c.email,
    ...
  }))
];
```

**Impact:** Can't see real staff or portal users; fake IDs generated on each load

**Fix Required:**
```typescript
const useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => request("/api/users")
  });
}
```

**Priority:** HIGH - Staff can't manage user accounts

---

#### 5. Backups Page 100% Mock

**Location:** `src/routes/_admin.backups.tsx`

**Issue:** Completely mock data with `Math.random()`
```typescript
size_mb: Math.random() * 100 + 200,  // Random 200-300 MB
status: ["completed", "failed", "pending"][Math.floor(Math.random() * 3)],
setTimeout(resolve, 2000);  // Simulates backup operation
```

**Impact:** Misleading UI showing fake backup sizes and statuses

**Decision Required:**
1. **Option A - Hide:** Add feature flag, disable in production
2. **Option B - Connect:** Create real `/api/backups` endpoint

**Fix:** Either
```typescript
// Option A: Hide
if (!import.meta.env.VITE_ENABLE_BACKUPS) {
  return <FeatureComingSoon />;
}

// Option B: Connect
const { data: backups } = useBackups();
```

**Priority:** MEDIUM - Not critical but misleading

---

### File-by-File Impact Matrix

| File | Current Status | Issue | Severity | Action |
|------|---|---|---|---|
| `mock-data.ts` | ACTIVE | Contains 8 clients + 12 services + financial data | HIGH | Review for production exposure |
| `mock-data-extra.ts` | ACTIVE | Contains domains, tickets, tasks, automations | MEDIUM | Review for production exposure |
| `repositories.ts` | USED | Mock DAO layer | MEDIUM | Used by api-client.ts fallback |
| `activity-log.ts` | ACTIVE | Hardcoded seed data | LOW | Audit trail is incomplete |
| `global-search.tsx` | BROKEN | Hardcoded search index | CRITICAL | Migrate to real API |
| `portal.tsx` | BROKEN | DEMO_CLIENT_ID bypass | CRITICAL | Add DEV check, fail gracefully |
| `portal.index.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Migrate to real API |
| `portal.pagos.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Migrate to real API |
| `portal.avisos.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Migrate to real API |
| `portal.dominios.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Migrate to real API |
| `portal.tickets.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Migrate to real API |
| `portal.datos.tsx` | BROKEN | Uses hardcoded client | CRITICAL | Use /api/auth/me |
| `_admin.operaciones.tsx` | STALE | Direct mock array usage | HIGH | Migrate to hooks |
| `_admin.usuarios.tsx` | FAKE | Math.random() user IDs | HIGH | Migrate to real API |
| `_admin.backups.tsx` | MOCK | 100% fake data | MEDIUM | Hide or connect |
| `_admin.index.tsx` | PARTIAL | KPIs from real API | LOW | Verify data accuracy |
| `_admin.clientes.*.tsx` | OK | Using real API | NONE | No changes |
| `_admin.servicios.*.tsx` | OK | Using real API | NONE | No changes |
| `_admin.dominios.*.tsx` | OK | Using real API | NONE | No changes |
| `_admin.pagos.tsx` | OK | Using real API | NONE | No changes |
| `_admin.avisos.tsx` | OK | Using real API | NONE | No changes |
| `_admin.soporte.*.tsx` | OK | Using real API | NONE | No changes |
| `_admin.tareas.*.tsx` | OK | Using real API | NONE | No changes |

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Security & Critical Issues (Must do before release)

**Portal Authentication:**
- [ ] Add `import.meta.env.DEV` check to `portal.tsx`
- [ ] Test: Staff without clientId gets error in production
- [ ] Test: Real customer sees own data

**Global Search:**
- [ ] Replace hardcoded imports with hooks
- [ ] Implement real-time search against `useClients()` + `useServices()`
- [ ] Test: Search returns live results

**Operations Dashboard:**
- [ ] Remove all mock-data imports
- [ ] Migrate to React Query hooks
- [ ] Test: Data refreshes when clients change

**User Management:**
- [ ] Remove Math.random() generation
- [ ] Create useUsers() hook
- [ ] Test: Real staff list shows in production

### Phase 2: High Priority (Next sprint)

**Backups Page:**
- [ ] Decide: hide or connect?
- [ ] If hiding: add feature flag
- [ ] If connecting: create real API
- [ ] Test: Either fully removed or fully real

**Activity/Audit Log:**
- [ ] Decide: show real or hide?
- [ ] Remove hardcoded seed data
- [ ] If showing: connect to real API
- [ ] Test: No more Math.random() IDs

**Email Logs:**
- [ ] Create API endpoint
- [ ] Migrate from mock
- [ ] Test: Real email history shows

### Phase 3: Verification

**Regression Testing:**
- [ ] All admin pages show no mock company names
- [ ] Dashboard shows 0 if no real data
- [ ] Portal fails gracefully
- [ ] Error states are handled
- [ ] No Math.random() in code paths

**Production Readiness:**
- [ ] Feature flags configured
- [ ] Error boundaries in place
- [ ] API timeout handling
- [ ] Monitoring alerts set up

---

## RISK REGISTER

### 🔴 RED ZONE (Blocking Issues)

| Risk | Likelihood | Impact | Mitigation |
|------|---|---|---|
| Portal shows demo customer to staff | HIGH | CRITICAL | Add `import.meta.env.DEV` check |
| Global search only finds 8 clients | HIGH | CRITICAL | Migrate to real API search |
| Operations dashboard misleads team | HIGH | HIGH | Show real data or empty state |
| User management generates fake IDs | HIGH | HIGH | Connect to real API |
| Staff can't find client they need | HIGH | CRITICAL | Fix search immediately |

### 🟡 YELLOW ZONE (High Priority)

| Risk | Likelihood | Impact | Mitigation |
|------|---|---|---|
| Backups page shows fake sizes | MEDIUM | MEDIUM | Hide in production |
| Activity log is fabricated | MEDIUM | MEDIUM | Use real audit trail |
| Email logs are incomplete | MEDIUM | MEDIUM | Connect to real API |
| MRR calculations are wrong | HIGH | HIGH | Calculate from real data |

### 🟢 GREEN ZONE (Can Be Addressed Later)

| Risk | Likelihood | Impact | Mitigation |
|------|---|---|---|
| Helper functions still in mock-data.ts | LOW | LOW | Refactor later |
| Automations still mock | LOW | MEDIUM | Connect when backend ready |

---

## TESTING STRATEGY

### Unit Tests
- Test that DEMO_CLIENT_ID is only used when `import.meta.env.DEV === true`
- Test that format helpers work correctly
- Test that data mappers transform correctly

### Integration Tests
- Test portal redirects staff without clientId
- Test global search returns API results
- Test operations dashboard updates in real-time

### E2E Tests
- Test complete user workflow: login → see own client → navigate → logout
- Test search finds clients created during test
- Test backups page (hidden or real)

### Manual Testing Checklist
- [ ] Refresh portal in dev mode → shows demo
- [ ] Refresh portal in prod → shows error or real client
- [ ] Search for hardcoded company name → should not appear
- [ ] Create new client via API → appears in search immediately
- [ ] Delete client → disappears from all views
- [ ] Backups page → either hidden or shows real backups

---

## PRODUCTION DEPLOYMENT

### Pre-Flight Checks
- [ ] All API endpoints tested and responding
- [ ] Error states are visually distinct
- [ ] Empty states show helpful messages
- [ ] Feature flags are configured correctly

### Monitoring
- [ ] Alert if API response time > 2 seconds
- [ ] Alert if error rate > 1%
- [ ] Alert if 404 errors spike (deleted resources)
- [ ] Alert if token refresh failures

### Rollback Plan
- If portal bypass discovered: immediately flip `import.meta.env.DEV` to false in build
- If search broken: disable global search temporarily
- If operations dashboard broken: show empty state until fixed

---

**NEXT STEP:** Review this audit with backend team and prioritize implementation by severity.

