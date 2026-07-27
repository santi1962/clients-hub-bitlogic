# Setup Inicial — Bitlogic Client Hub

**Objetivo:** Cargar datos reales (no ficticios) antes de llevar el sistema a producción.

**Fecha:** 2026-06-17  
**Status:** 🔧 En construcción (estructura lista, falta completar endpoints)

---

## ⚠️ IMPORTANTE

**NO inventar datos.**  
**NO usar placeholders.**  
**NO crear clientes si no tienes información real.**  
**Solo datos reales verificados.**

---

## 📋 Estructura de Setup Inicial

### Flujo recomendado:

```
1. EMPRESA
   ├─ Nombre comercial (ej: "Bitlogic S.R.L.")
   ├─ Email de contacto (ej: "contacto@bitlogic.com")
   ├─ Teléfono (opcional)
   ├─ CUIT (opcional)
   ├─ Dirección (opcional)
   └─ Moneda principal (ARS, USD, EUR)

2. PLANES DE HOSTING
   ├─ Listar planes existentes
   ├─ Crear nuevos planes:
   │  ├─ Nombre (ej: "Business")
   │  ├─ Descripción
   │  ├─ Espacio (GB)
   │  ├─ Sitios permitidos
   │  ├─ Correos permitidos
   │  └─ Precio mensual (REAL)
   └─ NO inventar precios

3. CLIENTES REALES
   ├─ Crear cliente:
   │  ├─ Empresa
   │  ├─ Nombre contacto
   │  ├─ Email
   │  ├─ Teléfono
   │  ├─ CUIT/DNI (opcional)
   │  └─ Notas
   └─ Datos VERIFICADOS de tu base actual

4. SERVICIOS DE HOSTING
   ├─ Crear servicio:
   │  ├─ Seleccionar CLIENTE (debe existir)
   │  ├─ Dominio
   │  ├─ Seleccionar PLAN (debe existir)
   │  ├─ Precio mensual
   │  ├─ Fecha de alta
   │  ├─ Próxima fecha de pago
   │  ├─ Usuario Hestia (opcional)
   │  ├─ URL Hestia (opcional)
   │  └─ Estado (activo/suspendido/cancelado)
   └─ VALIDACIONES:
      ├─ No permitir sin cliente
      ├─ No permitir sin plan
      └─ No permitir precio vacío

5. DOMINIOS
   ├─ Crear dominio:
   │  ├─ Nombre de dominio
   │  ├─ Seleccionar CLIENTE
   │  ├─ Servicio (opcional, si existe)
   │  ├─ Registrador (ej: NIC.ar)
   │  ├─ Fecha de vencimiento
   │  ├─ Renovación automática (sí/no)
   │  ├─ Costo anual
   │  └─ Precio cobrado al cliente
   └─ CRÍTICO: Fechas de vencimiento reales

6. USUARIOS DEL PORTAL
   ├─ Crear usuario:
   │  ├─ Email
   │  ├─ Seleccionar CLIENTE vinculado
   │  ├─ Generar contraseña temporal
   │  └─ Estado (activo/inactivo)
   └─ Solo para clientes que REALMENTE usen portal
```

---

## ✅ CHECKLIST DE READINESS

Sistema listo cuando:

- [x] Empresa configurada (nombre + email mínimo)
- [x] Al menos 1 plan de hosting activo con precio real
- [x] Al menos 1 cliente real en la BD
- [x] Al menos 1 servicio de hosting real
- [x] Al menos 1 usuario del portal (si lo usas)
- [x] SMTP configurado (si envías emails)
- [x] Hestia configurado (si sincronizas)

**Si alguno falta → Sistema NO listo → No pasar a producción.**

---

## 🛠️ CÓMO ACCEDER AL SETUP INICIAL

### URL:
```
http://localhost:4173/setup-inicial
```

### Requisitos:
- Backend corriendo: `npm start` (en backend/)
- Frontend corriendo: `npm run preview` (en raíz)
- Logged in como ADMIN

---

## 📝 SECCIONES DETALLADAS

### A) CONFIGURACIÓN DE EMPRESA

**Campos:**
- Nombre Comercial *requerido*
- Email de Contacto *requerido*
- Teléfono (opcional)
- CUIT (opcional)
- Dirección (opcional)
- Moneda Principal (ARS, USD, EUR)

**Ejemplo:**
```
Nombre: Bitlogic S.R.L.
Email: contacto@bitlogic.com.ar
Teléfono: +54 9 11 2345 6789
CUIT: 30-12345678-9
Dirección: Av. Corrientes 1234, Buenos Aires
Moneda: ARS
```

**Endpoint:**
```
POST /api/settings/company
PATCH /api/settings/company
GET /api/settings/company
```

---

### B) PLANES DE HOSTING

**Campos por plan:**
- Nombre *requerido* (ej: "Business")
- Descripción
- Espacio en GB *requerido*
- Sitios permitidos (null = ilimitados)
- Correos permitidos (null = ilimitados)
- Precio mensual *requerido* (ej: 35.00)
- Estado (activo/inactivo)

**NO INVENTAR PRECIOS.**  
Usa tu lista de precios oficial.

**Ejemplo:**
```
Plan: Business
Espacio: 40 GB
Sitios: ilimitados
Correos: ilimitados
Precio: $35.00/mes
Estado: activo
```

**Endpoint:**
```
GET /api/hosting/plans
POST /api/hosting/plans
PATCH /api/hosting/plans/:id
DELETE /api/hosting/plans/:id
```

---

### C) CLIENTES REALES

**Campos:**
- Empresa *requerido*
- Nombre Contacto *requerido*
- Email *requerido*
- Teléfono
- CUIT/DNI (opcional)
- Notas

**VALIDACIÓN:**
- No permitir empresa vacía
- No permitir email inválido
- No duplicar emails

**Ejemplo:**
```
Empresa: Tienda Méndez
Contacto: Juan Méndez
Email: juan@tiendamendez.com
Teléfono: +54 9 11 1234 5678
CUIT: 23-98765432-1
```

**Endpoint:**
```
GET /api/clients
POST /api/clients
PATCH /api/clients/:id
DELETE /api/clients/:id
```

---

### D) SERVICIOS DE HOSTING

**Campos:**
- Cliente *requerido* (select dropdown)
- Dominio *requerido*
- Plan *requerido* (select dropdown)
- Precio mensual *requerido* (debe coincidir con plan)
- Fecha de alta
- Próxima fecha de pago *requerido*
- Usuario Hestia (opcional)
- URL Hestia (opcional)
- Estado (activo/suspendido/cancelado)

**VALIDACIONES CRÍTICAS:**
- No permitir sin cliente seleccionado
- No permitir sin plan seleccionado
- No permitir precio vacío
- No permitir fecha próx pago vacía
- Precio no puede ser < 0

**Ejemplo:**
```
Cliente: Tienda Méndez
Dominio: tiendamendez.com
Plan: Pro ($18/mes)
Precio: $18.00
Fecha alta: 2025-06-01
Próxima pago: 2025-07-01
Usuario Hestia: tiendamendez
```

**Endpoint:**
```
GET /api/hosting/services
POST /api/hosting/services
PATCH /api/hosting/services/:id
DELETE /api/hosting/services/:id
```

---

### E) DOMINIOS

**Campos:**
- Dominio *requerido*
- Cliente *requerido* (select)
- Servicio (opcional - select)
- Registrador *requerido*
- Fecha de vencimiento *requerido*
- Renovación automática (sí/no)
- Costo anual del registrador
- Precio cobrado al cliente

**CRÍTICO:**
- Fechas de vencimiento DEBEN ser reales
- El sistema te alertará cuando falten 30/7/3 días

**Ejemplo:**
```
Dominio: tiendamendez.com
Cliente: Tienda Méndez
Servicio: tiendamendez.com (hosting)
Registrador: NIC.ar
Vencimiento: 2026-06-15
Renovación auto: sí
Costo registrador: $400 ARS/año
Precio cliente: $400 ARS/año
```

**Endpoint:**
```
GET /api/domains
POST /api/domains
PATCH /api/domains/:id
DELETE /api/domains/:id
```

---

### F) USUARIOS DEL PORTAL

**Campos:**
- Email *requerido*
- Cliente vinculado *requerido*
- Contraseña temporal (generada o ingresada)
- Estado (activo/inactivo)

**IMPORTANTE:**
- Solo crear para clientes que REALMENTE usarán el portal
- El email debe ser verificable
- La contraseña debe ser comunicada de forma segura

**Ejemplo:**
```
Email: juan@tiendamendez.com
Cliente: Tienda Méndez
Contraseña: Temp@1234 (cambiar en primer login)
Estado: activo
```

**Endpoint:**
```
GET /api/users?role=cliente
POST /api/users
PATCH /api/users/:id
```

---

## 📊 VERIFICACIÓN DE READINESS

**GET /api/settings/readiness**

Devuelve:
```json
{
  "ready": true/false,
  "checks": {
    "companyConfigured": true/false,
    "activePlansExist": true/false,
    "realClientsExist": true/false,
    "realServicesExist": true/false,
    "portalUsersExist": true/false,
    "smtpConfigured": true/false,
    "hestiaConfigured": true/false
  },
  "warnings": ["..."],
  "readyForProduction": true/false
}
```

---

## 🚀 DESPUÉS DEL SETUP INICIAL

Una vez configurado:

1. **Build final:**
   ```bash
   npm run build
   ```

2. **Commit:**
   ```bash
   git add .
   git commit -m "chore: initial setup completed with real data"
   git push origin main
   ```

3. **Seguir DEPLOYMENT_GUIDE.md para deploy en VPS**

4. **En producción:**
   - El setup inicial seguirá disponible para editar datos
   - NO hay "modo demo"
   - TODO lo que se vea es DATA REAL
   - Cambios en setup inmediatamente reflejados en dashboard

---

## ❌ LO QUE NO HACER

```
❌ NO crear clientes ficticios (Estudio Acosta, etc.)
❌ NO usar placeholders en emails
❌ NO inventar precios
❌ NO crear datos de test/demo en producción
❌ NO usar seeds con datos falsos
❌ NO asumir información
❌ NO crear servicios sin cliente
❌ NO crear servicios sin plan
❌ NO crear usuarios sin cliente vinculado
```

---

## ✅ LO QUE SÍ HACER

```
✅ Cargar datos actuales de tus registros
✅ Usar información verificada
✅ Crear solo lo que realmente tienes
✅ Dejar campos vacíos si falta info
✅ Precios reales de tu lista oficial
✅ Dominios reales con fechas correctas
✅ Usuarios portal solo si los usas
✅ Cambiar/editar datos en cualquier momento
```

---

## 📞 SOPORTE

Si faltan datos o no sabes qué colocar:

1. **Compilar información real:**
   - Lista de clientes actuales
   - Lista de servicios activos
   - Lista de dominios registrados
   - Precios vigentes
   - Usuarios que acceden al portal

2. **Completar el setup inicial con esa información**

3. **Dejar vacíos los campos opcionales**

4. **NO inventar nada**

---

## 📦 ARCHIVO FINAL

```
Cambios realizados:
├─ src/routes/setup-inicial.tsx (nueva)
├─ src/components/setup/ (nueva carpeta)
│  ├─ setup-company.tsx
│  ├─ setup-plans.tsx
│  ├─ setup-clients.tsx
│  ├─ setup-services.tsx
│  ├─ setup-domains.tsx
│  ├─ setup-users.tsx
│  └─ setup-readiness.tsx
├─ backend/src/routes/settings.routes.js (nuevo)
├─ backend/src/routes/plans.routes.js (nuevo)
├─ backend/src/controllers/settings.controller.js (nuevo)
├─ backend/src/controllers/plans.controller.js (nuevo)
├─ backend/src/services/settings.service.js (nuevo)
├─ backend/src/services/plans.service.js (nuevo)
├─ backend/package.json (actualizado - scripts)
└─ SETUP_INICIAL_GUIDE.md (este archivo)

Deshabilitados:
├─ backend/src/scripts/create-real-test-data.js
└─ npm run create-real-test-data (reemplazado por setup web)
```

---

**Última actualización:** 2026-06-17  
**Estado:** 🔧 Estructura lista, endpoints pendientes de completar

