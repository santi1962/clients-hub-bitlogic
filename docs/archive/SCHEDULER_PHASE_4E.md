# Fase 4E.1 - Scheduler Infrastructure

**Status:** ✅ COMPLETADO

Base de infraestructura para automatizaciones operativas.

---

## 📋 Archivos Creados

```
backend/src/services/scheduler.service.js
  └─ Servicio central de gestión de jobs
     ├─ registerJob()
     ├─ executeJob()
     ├─ saveLog()
     ├─ getLogs() + filtering
     └─ getLatestLog()

backend/src/controllers/scheduler.controller.js
  └─ Controlador para endpoints

backend/src/routes/scheduler.routes.js
  └─ Rutas REST (admin only)

backend/src/jobs/payment-reminders.job.js
  └─ Detecta avisos próximos a vencer (7, 3, 0, -7 días)

backend/src/jobs/delinquency-detection.job.js
  └─ Detecta morosidad (servicios/avisos > 7 días vencidos)

backend/src/jobs/hestia-sync.job.js
  └─ Lista servicios listos para sincronizar con Hestia

backend/src/migrations/009_scheduler_logs_schema.sql
  └─ Tabla scheduler_logs con logs de ejecución

backend/src/app.js
  └─ Registra jobs (líneas 61-74)

backend/src/db/migrate.js
  └─ Agregada migración 009
```

---

## 🔧 Endpoints Disponibles

**Todos requieren admin/super_admin**

### 1. Listar jobs registrados
```bash
GET /api/scheduler/jobs
```

Response:
```json
{
  "data": [
    {
      "name": "payment_reminders_daily",
      "description": "Detect payment notices due soon (7, 3, 0, -7 days)",
      "lastRun": null
    },
    {
      "name": "delinquency_detection_daily",
      "description": "Detect overdue payments and services (>7 days)",
      "lastRun": null
    },
    {
      "name": "hestia_sync_daily",
      "description": "List services with HestiaCP usernames (ready for sync)",
      "lastRun": null
    }
  ],
  "meta": { "total": 3 }
}
```

### 2. Ejecutar job manualmente
```bash
POST /api/scheduler/jobs/:jobName/run
```

Response (ejemplo hestia_sync_daily):
```json
{
  "jobName": "hestia_sync_daily",
  "log": {
    "jobName": "hestia_sync_daily",
    "status": "success",
    "startedAt": "2026-06-17T13:58:29.170Z",
    "finishedAt": "2026-06-17T13:58:29.172Z",
    "durationMs": 2,
    "summary": {
      "servicesWithHestia": 12,
      "uniqueUsers": 12,
      "usersDetected": ["belladermo", "blogbella", ...],
      "storageByUser": {...},
      "status": "ready_for_sync"
    }
  },
  "message": "Job hestia_sync_daily executed"
}
```

### 3. Obtener logs de ejecución
```bash
GET /api/scheduler/logs?jobName=payment_reminders_daily&status=success&page=1&limit=50
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "job_name": "payment_reminders_daily",
      "status": "success",
      "started_at": "2026-06-17T13:58:28.748Z",
      "finished_at": "2026-06-17T13:58:28.759Z",
      "duration_ms": 11,
      "summary": {
        "totalNotices": 5,
        "dueIn7Days": 0,
        "dueIn3Days": 1,
        "dueToday": 0,
        "overdue7Days": 0,
        "noticesByStatus": { "sent": 4, "pending": 1 }
      },
      "error_message": null,
      "created_at": "2026-06-17T13:58:28.760Z"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 6 }
}
```

### 4. Obtener último log de un job
```bash
GET /api/scheduler/jobs/:jobName/latest
```

---

## 📊 Jobs Implementados

### Job 1: payment_reminders_daily
**Función:** Detectar avisos próximos a vencer

**Detección:**
- `dueIn7Days`: Vencen en exactamente 7 días
- `dueIn3Days`: Vencen en exactamente 3 días
- `dueToday`: Vencen hoy
- `overdue7Days`: Vencidos hace más de 7 días

**Datos retornados:**
```json
{
  "totalNotices": 5,
  "dueIn7Days": 0,
  "dueIn3Days": 1,
  "dueToday": 0,
  "overdue7Days": 0,
  "noticesByStatus": {
    "sent": 4,
    "pending": 1
  }
}
```

**Estado actual:** ✅ Solo detección (no envía emails)

---

### Job 2: delinquency_detection_daily
**Función:** Detectar morosidad en pagos y servicios

**Detección:**
- Avisos de pago vencidos > 7 días
- Servicios con nextDueDate vencida > 7 días

**Datos retornados:**
```json
{
  "overdueNotices": 0,
  "overdueServices": 3,
  "overdueClients": 3,
  "totalOverdueAmount": 24,
  "noticesDetails": [],
  "servicesDetails": [
    {
      "domain": "blog.belladermo.com",
      "daysOverdue": 46,
      "monthlyPrice": "8.00"
    }
  ]
}
```

**Estado actual:** ✅ Solo detección (no crea tasks)

---

### Job 3: hestia_sync_daily
**Función:** Listar servicios listos para sincronizar con Hestia

**Detección:**
- Servicios que tienen `hestia_username` configurado
- Agrupa por usuario
- Calcula almacenamiento total por usuario

**Datos retornados:**
```json
{
  "servicesWithHestia": 12,
  "uniqueUsers": 12,
  "usersDetected": [
    "belladermo",
    "blogbella",
    ...
  ],
  "storageByUser": {
    "belladermo": {
      "count": 1,
      "totalGb": 9.7
    }
  },
  "status": "ready_for_sync"
}
```

**Estado actual:** ✅ Solo detección (no sincroniza)

---

## 🔒 Seguridad

- ✅ Solo super_admin y admin pueden ejecutar jobs
- ✅ Jobs **NO modifican** nada (solo lectura + logs)
- ✅ **NO envían emails** (solo detección)
- ✅ **NO crean tasks** (solo detección)
- ✅ **NO modifican Hestia** (solo listado)
- ✅ Logs guardados en BD para auditoría

---

## 📈 Pruebas Realizadas

```
✅ Backend: inicia correctamente
✅ Scheduler: registra 3 jobs
✅ payment_reminders_daily: 5 notices detectados, 1 vence en 3 días
✅ delinquency_detection_daily: 3 servicios vencidos (46, 18, 16 días)
✅ hestia_sync_daily: 12 servicios con Hestia, 12 usuarios únicos
✅ Logs: guardados en BD con status, duration, summary
✅ Endpoints: todos funcionales con filtros
```

---

## 📝 Próximas Fases

### Fase 4E.2: Cron Automático (opcional)
- Ejecutar jobs automáticamente con node-cron
- Schedule: diarias a horarios específicos
- No se agregará en 4E.1 (manual por ahora)

### Fase 4E.3: Acciones Reales
- Enviar emails de recordatorio
- Crear tasks de morosidad
- Sincronizar Hestia automáticamente

### Fase 4E.4: Dashboard
- Gráficos de MRR, deuda, ingresos
- KPIs operativos

---

## 🚀 Cómo Usar

**Ejecutar un job manualmente:**
```bash
curl -X POST http://localhost:3001/api/scheduler/jobs/payment_reminders_daily/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Ver logs:**
```bash
curl http://localhost:3001/api/scheduler/logs?status=success \
  -H "Authorization: Bearer $TOKEN"
```

**Ver jobs registrados:**
```bash
curl http://localhost:3001/api/scheduler/jobs \
  -H "Authorization: Bearer $TOKEN"
```

---

**Última actualización:** 2026-06-17  
**Estado:** Infraestructura lista para acciones en Fase 4E.2+
