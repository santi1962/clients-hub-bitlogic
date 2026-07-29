# Scheduler de automatizaciones (node-cron)

Cablea los jobs ya existentes (`hestia-sync`, `delinquency-detection`, `payment-reminders`) para que corran solos, además de poder seguir disparándose a mano desde `/admin/automatizaciones`. No agrega reglas de negocio nuevas — los jobs hacen exactamente lo mismo que hacían antes.

## Horarios (producción)

Timezone: `America/Argentina/Buenos_Aires`

| Job | Cron | Hora local | Qué hace |
|---|---|---|---|
| `hestia-sync` | `30 2 * * *` | 02:30 todos los días | Lee `hosting_services` y reporta uso de disco/usuarios detectados en Hestia. **Solo lectura** — no llama a la API de Hestia ni escribe nada. |
| `delinquency-detection` | `0 8 * * *` | 08:00 todos los días | Lee avisos y servicios vencidos hace más de 7 días y arma un resumen. **Solo lectura** — no suspende ni modifica ningún servicio, no ejecuta ningún `UPDATE`. |
| `payment-reminders` | `0 9 * * *` | 09:00 todos los días | Manda recordatorio por email (y WhatsApp si está habilitado) de avisos por vencer. Solo manda algo si el toggle correspondiente está habilitado en Configuración → Automatizaciones (hoy están todos deshabilitados por defecto). Tiene deduplicación propia por aviso+tipo+día, así que no duplica envíos aunque corra más de una vez el mismo día. |

## Habilitar / deshabilitar

```bash
SCHEDULER_ENABLED=true   # corre los 3 jobs solos, en los horarios de arriba
SCHEDULER_ENABLED=false  # no programa nada — los jobs solo se pueden correr a mano
```

Default: `false` en desarrollo, `true` en producción (si no se setea explícitamente).

**Importante:** la ejecución manual desde el panel funciona igual esté esto en `true` o `false` — el toggle solo afecta si además corren solos por cron.

## Cambiar horarios sin tocar código

```bash
SCHEDULER_TIMEZONE=America/Argentina/Buenos_Aires  # timezone de todos los jobs

# Overrides individuales (formato cron estándar, opcionalmente con segundos
# como primer campo). Si no se setean, se usa el horario de producción de la tabla de arriba.
SCHEDULE_HESTIA_SYNC=30 2 * * *
SCHEDULE_DELINQUENCY_DETECTION=0 8 * * *
SCHEDULE_PAYMENT_REMINDERS=0 9 * * *
```

Si una expresión cron es inválida, ese job específico no se programa (se loguea un error) pero el resto del scheduler y el backend siguen funcionando normalmente, y el job sigue disponible para ejecución manual.

## Ejecución manual

Desde `/admin/automatizaciones` (o directo por API, requiere rol admin):

```
GET  /api/scheduler/jobs                 # lista los 3 jobs registrados
POST /api/scheduler/jobs/:jobName/run    # ejecuta uno a mano
GET  /api/scheduler/jobs/:jobName/latest # último resultado
GET  /api/scheduler/logs                 # historial completo
```

Manual y automático comparten el mismo lock: si un job ya está corriendo (por cualquiera de los dos caminos), un segundo disparo manual responde `409 Job X is already running` y un segundo disparo por cron se omite silenciosamente (queda logueado, no se trata como error).

## Revisar logs de ejecución (`scheduler_logs`)

Cada fila tiene `job_name`, `status` (`running`/`success`/`failed`), `started_at`, `finished_at`, `duration_ms`, `summary` (JSON) y `error_message`. Dentro de `summary` además viene:

- `trigger`: `"manual"` o `"scheduled"`.
- `executionId`: UUID propio de esa ejecución, para correlacionar con los logs del proceso (PM2 / `pm2 logs`).

Una ejecución omitida por lock **no** genera fila en `scheduler_logs` (la tabla no admite un status `skipped` sin una migración — se decidió no hacer esa migración en esta fase). Queda visible igual en los logs de PM2, con el `executionId` correspondiente.

## Comportamiento ante fallo

- Un job que falla queda registrado con `status: "failed"` y el mensaje de error (saneado: no incluye URLs de conexión a Postgres ni tokens `Bearer`).
- El backend y el resto de los jobs programados **no se ven afectados** por el fallo de uno.
- No hay reintentos automáticos. El próximo tick diario de cron vuelve a intentar solo. La ejecución manual sigue disponible en cualquier momento.

## Apagado del backend

Al recibir `SIGTERM`/`SIGINT`, el backend: detiene el cron (no arrancan ejecuciones nuevas) → cierra el servidor HTTP → espera de forma acotada (hasta 8s) a que termine cualquier job en curso → cierra Socket.IO → cierra el pool de PostgreSQL. Si un job no termina en ese tiempo, el proceso sigue cerrando igual (se loguea cuál quedó sin terminar) — no queda colgado indefinidamente.

## Límite de la instancia única

El lock anti-duplicados (`runningJobs`) vive en memoria del proceso. Funciona correctamente porque el backend corre en **una sola instancia PM2 (modo fork)** — el mismo requisito que ya existía por Socket.IO. Si en algún momento se escala a más de una instancia, este lock deja de servir (cada instancia tendría su propio Set en memoria, sin coordinación entre ellas) y haría falta reemplazarlo por un lock a nivel de base de datos (`pg_advisory_lock`) antes de escalar.

## La suspensión de servicios sigue siendo manual

Ninguno de estos 3 jobs suspende, reactiva ni modifica servicios de hosting. `delinquency-detection` solo detecta y reporta morosidad — la decisión y acción de suspender un servicio la sigue tomando una persona desde el panel.
