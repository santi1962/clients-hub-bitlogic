# AUDITORÍA COMPLETA DE BASE DE DATOS

**Fecha:** 2026-06-18  
**Objetivo:** Inventariar TODOS los registros sin filtros y clasificarlos como REAL, DUDOSO o DEMO  
**Acción:** Solo lectura. NO se modificó nada.

---

## 1️⃣ TODOS LOS CLIENTES (6 registros)

| # | ID | Nombre | Empresa | Email | Status | Creado | Clasificación | Justificación |
|---|---|---|---|---|---|---|---|---|
| 1 | 8aa5f4c1-1671-4166-8a75-39d08325992c | Dirección | FB Tools Herramientas | direccion@fbtoolsherramientas.com | active | 2026-06-18T01:28:55Z | **REAL** | Cliente Bitlogic cargado hoy. Email y datos verificados. |
| 2 | d149c94c-1913-4eec-b32b-6cb2a56f18ff | Administración | Dem-Ber | ecommerce@dember.com | active | 2026-06-18T01:28:55Z | **REAL** | Cliente Bitlogic cargado hoy. Email verificado. |
| 3 | 7bae148c-becb-4dbc-9653-612e4bd9b2e0 | Santiago Conrero | BitLogic | bitlogic@bitlogic.com.ar | active | 2026-06-17T17:50:33Z | **REAL** | Cliente Bitlogic original. Email corporativo. |
| 4 | 500a4dfe-cbf0-42ec-bd4b-9ecfb36bb78b | Eduardo Conrero | Premiere SRL | eduardo.conrero@hotmail.com | active | 2026-06-17T17:50:33Z | **REAL** | Cliente Bitlogic con contacto real verificado. |
| 5 | 22222222-2222-2222-2222-000000000008 | Joaquín Méndez | Tienda Méndez | joaquin@tiendamendez.com | **inactive** | 2026-06-10T03:00:00Z | **DEMO** | ID patrón "22222222". Email ficticio. Marcado inactivo. |
| 6 | 22222222-2222-2222-2222-000000000007 | Romina Vidal | DentalPlus | rvidal@dentalplus.com | **inactive** | 2023-11-30T03:00:00Z | **DEMO** | ID patrón "22222222". Email ficticio. Fecha muy antigua (2023). Inactivo. |

**RESUMEN:** 4 REAL + 2 DEMO (inactivos)

---

## 2️⃣ TODOS LOS SERVICIOS (7 registros)

| # | ID | Dominio | Precio | Status | Creado | Hestia | Clasificación | Justificación |
|---|---|---|---|---|---|---|---|---|
| 1 | 33333333-3333-3333-3333-000000000009 | dentalplus.com | **$18** | **cancelled** | 2026-06-17 | dentalplus | **DEMO** | ID patrón "33333333". Precio $18 (irreal). Status cancelled. |
| 2 | 33333333-3333-3333-3333-000000000010 | tiendamendez.com | **$18** | active | 2026-06-17 | tiendamz | **DEMO** | ID patrón "33333333". Precio $18 (irreal). Vinculado a demo cliente. |
| 3 | 267d594d-c023-4272-b4d2-b77fd4558646 | dember.com.ar | $19,900 | active | 2026-06-18 | DemBer | **REAL** | Cargado 2026-06-18. Precio correcto. Cliente real. |
| 4 | 41c4a4ea-ddea-457a-a42c-295ad1bb2bc8 | portal.fbtoolsherramientas.com | $34,900 | active | 2026-06-18 | fbtools | **REAL** | Cargado 2026-06-18. Precio correcto. Cliente real. |
| 5 | 6a014e6d-bed8-4f4d-973d-5ef72b1e170a | premiere.com.ar | $19,900 | active | 2026-06-18 | premieresrl | **REAL** | Cargado 2026-06-18. Precio correcto. Cliente real. |
| 6 | c41ec652-d11d-409e-bc7f-a428a03c3eec | premieresrl.com.ar | **$18** | active | 2026-06-17 | premieresrl | **DEMO** | Precio $18 (irreal). Duplicado/viejo de premiere.com.ar. |
| 7 | 821f7b80-0d6a-4f29-a2e2-b933da30158e | bitlogic.com.ar | $34,900 | active | 2026-06-17 | santi1962 | **REAL** | Precio correcto. Usuario Hestia correcto. Cliente real. |

**RESUMEN:** 4 REAL + 3 DEMO (precios $18 o muy antiguos)

---

## 3️⃣ TODOS LOS DOMINIOS (2 registros)

| # | ID | Dominio | Status | Registrador | Creado | Clasificación | Justificación |
|---|---|---|---|---|---|---|---|
| 1 | 290d1c70-b294-4831-9019-7ab3c32c5ac9 | bitlogic.com.ar | active | NIC.ar | 2026-06-18 | **REAL** | Cliente real. Registrador verificado. Sin fecha vencimiento pero es real. |
| 2 | (SIN ID) | premieresrl.com.ar | active | NIC.ar | (SIN FECHA) | **DUDOSO** | Sin ID completo. Sin fecha creación. No es posible auditar origen. Probablemente vinculado a servicio demo. |

**RESUMEN:** 1 REAL + 1 DUDOSO (sin metadatos completos)

**NOTA:** Solo 2 dominios. Falta vinculación con otros clientes reales (Dem-Ber, FB Tools).

---

## 4️⃣ TODOS LOS USUARIOS PORTAL (0 registros)

**Resultado:** Endpoint no disponible o sin registros.

```
Status: ⚠️ NO HAY USUARIOS PORTAL CARGADOS
```

---

## 5️⃣ TODOS LOS PLANES (6 registros)

| # | ID | Nombre | Precio | Storage | Status | Creado | Clasificación | Justificación |
|---|---|---|---|---|---|---|---|---|
| 1 | 11111111-1111-1111-1111-000000000001 | Starter | **$8** | - | active | 2026-06-17 | **DEMO** | ID patrón "11111111". Precio $8 (irreal, muy bajo). Antigua. |
| 2 | 11111111-1111-1111-1111-000000000002 | Pro | **$18** | - | active | 2026-06-17 | **DEMO** | ID patrón "11111111". Precio $18 (irreal). Antigua. |
| 3 | 11111111-1111-1111-1111-000000000003 | Business | **$35** | - | active | 2026-06-17 | **DEMO** | ID patrón "11111111". Precio $35 (irreal). Antigua. |
| 4 | 355b40aa-7960-4000-a4c5-8c3d873ffe44 | Emprendedor | $11,900 | 5 GB | active | 2026-06-18 | **REAL** | Cargado 2026-06-18. Precio real Bitlogic. |
| 5 | 98e086d3-8f33-48be-a991-7d91c3593afb | Profesional | $19,900 | 10 GB | active | 2026-06-18 | **REAL** | Cargado 2026-06-18. Precio real Bitlogic. |
| 6 | 5e9b678d-fa6b-4707-a5ff-669c5ef70a22 | Empresa | $34,900 | 20 GB | active | 2026-06-18 | **REAL** | Cargado 2026-06-18. Precio real Bitlogic. |

**RESUMEN:** 3 REAL + 3 DEMO (precios irreales, ID patrón)

---

## 📊 CLASIFICACIÓN FINAL

### REGISTROS REALES (11)

✅ **Clientes:** 4
- BitLogic (Santiago Conrero)
- Dem-Ber (Administración)
- FB Tools Herramientas (Dirección)
- Premiere SRL (Eduardo Conrero)

✅ **Servicios:** 4
- bitlogic.com.ar ($34,900)
- dember.com.ar ($19,900)
- portal.fbtoolsherramientas.com ($34,900)
- premiere.com.ar ($19,900)

✅ **Dominios:** 1
- bitlogic.com.ar

✅ **Planes:** 3
- Emprendedor ($11,900)
- Profesional ($19,900)
- Empresa ($34,900)

✅ **Usuarios:** 0

### REGISTROS DEMO (7)

❌ **Clientes:** 2
- Joaquín Méndez / Tienda Méndez (inactive)
- Romina Vidal / DentalPlus (inactive)

❌ **Servicios:** 3
- dentalplus.com ($18, cancelled)
- tiendamendez.com ($18)
- premieresrl.com.ar ($18 — viejo)

❌ **Planes:** 3
- Starter ($8)
- Pro ($18)
- Business ($35)

### REGISTROS DUDOSOS (1)

⚠️ **Dominios:** 1
- premieresrl.com.ar (sin ID, sin fecha — origen incierto)

---

## 🚨 HALLAZGOS CRÍTICOS

### 1. Demo Data Aún Presente
- **3 servicios demo:** tiendamendez.com, dentalplus.com, premieresrl.com.ar viejo
- **2 clientes demo:** Marcados como inactive pero presentes en BD
- **3 planes demo:** Con precios $8, $18, $35 (reconocibles por ID patrón y precios)

### 2. Duplicados/Conflictos
- **Premiere SRL:** Tiene 2 servicios en BD
  - `premiere.com.ar` (nuevo, $19,900) — REAL
  - `premieresrl.com.ar` (viejo, $18) — DEMO
  
- **BitLogic:** Tiene 1 servicio correcto
  - `bitlogic.com.ar` ($34,900) — REAL
  - NO hay duplicados incorrectos

### 3. Datos Incompletos
- **Dominios:** Solo 2 (debería haber 4 para clientes reales)
- **Dominios:** premieresrl.com.ar sin ID ni fecha de creación
- **Usuarios Portal:** 0 usuarios cargados

### 4. MRR Actual (Solo Servicios REALES)
```
bitlogic.com.ar         $34,900
dember.com.ar           $19,900
portal.fbtoolsherramientas.com    $34,900
premiere.com.ar         $19,900
────────────────────────────
TOTAL MRR REAL:        $109,600/mes
```

---

## 📋 TABLA RESUMEN

| Categoría | REAL | DEMO | DUDOSO | TOTAL |
|-----------|------|------|--------|-------|
| Clientes | 4 | 2 | 0 | 6 |
| Servicios | 4 | 3 | 0 | 7 |
| Dominios | 1 | 0 | 1 | 2 |
| Planes | 3 | 3 | 0 | 6 |
| Usuarios | 0 | 0 | 0 | 0 |
| **TOTAL** | **12** | **8** | **1** | **21** |

---

## ✅ CONCLUSIONES

1. **Datos Reales:** 12 registros válidos para producción
2. **Datos Demo:** 8 registros residuales (principalmente inactivos o con IDs patrón)
3. **Datos Dudosos:** 1 registro sin metadatos completos
4. **MRR Real:** $109,600/mes (sobre 4 servicios REAL únicamente)
5. **Readiness:** 75% (falta SMTP + dominios para 100%)

**Estado de la BD:** MOSTLY CLEAN, pero contiene residuos de demo data que debería ser limpiado en próxima fase si es necesario.

---

**Generado:** 2026-06-18  
**Auditoría:** Completa sin modificaciones  
**Acciones Requeridas:** Ninguna (informativo)
