# Bitlogic Client Hub — Estado de producción

**Última actualización:** 2026-07-27
**Fuente de verdad vigente.** Todo lo que esté en `docs/archive/` es documentación histórica de sesiones de desarrollo anteriores y **no debe usarse como referencia** — puede contradecir este documento y el código real. Ante cualquier duda, este archivo y el código ganan siempre.

---

## Qué es

Sistema interno de Bitlogic (empresa de hosting) para gestionar clientes, servicios de hosting, dominios, facturación/cobranza, soporte y tareas, más un portal separado para que los clientes finales vean sus propios datos y paguen. Uso privado de Bitlogic — no es un producto multi-tenant.

## Arquitectura real

- **Frontend:** React + TanStack Start (SSR real, no SPA estática) + Vite. Build genera `dist/client/` y `dist/server/`.
- **Backend:** Express + Node ESM, PostgreSQL con SQL directo (sin ORM).
- **Tiempo real:** Socket.IO para el chat de tickets — sin adapter compartido, por lo que el backend **debe** correr en 1 sola instancia (fork), nunca en cluster/múltiples workers.
- **Auth:** JWT access token (15 min, en memoria del navegador) + refresh token en cookie httpOnly (30 días / 1 día).
- **Proceso:** PM2 con `ecosystem.config.js` (raíz del repo) — 2 apps (`bitlogic-backend`, `bitlogic-frontend`), ambas fork/1 instancia.

## Módulos funcionales — estado

Todos los módulos del panel admin y del portal cliente (Clientes, Servicios, Planes, Dominios, Pagos, Avisos, Cobranza, Soporte/Tickets, Tareas, Usuarios y permisos, Workflows, Plantillas, Logs de Email, Backups, Auditoría, Dashboard/Negocio, Configuración, Portal del cliente) están **funcionales y probados** con datos reales (Playwright + pruebas manuales de API).

**Automatizaciones:** los 3 jobs (`hestia-sync`, `delinquency-detection`, `payment-reminders`) ahora corren solos vía `node-cron` (`SCHEDULER_ENABLED=true` en producción), además de poder seguir disparándose a mano desde el panel — ambos caminos comparten el mismo lock, así que no pueden pisarse. Ver `docs/SCHEDULER.md` para horarios, timezone y cómo deshabilitarlo. Antes de esta fase, la ejecución manual estaba rota (los jobs nunca se registraban, todo intento daba 404) — quedó corregido de paso.

- `hestia-sync` y `delinquency-detection` son de **solo lectura**: no sincronizan nada en Hestia ni suspenden servicios, solo reportan. `delinquency-detection` en particular no puede alterar ni suspender un servicio bajo ninguna circunstancia — no ejecuta ningún `UPDATE`.
- `payment-reminders` sí manda emails reales, pero solo si el toggle correspondiente (`reminder_7_days`/`3_days`/`due_today`) está habilitado en automation_settings — hoy los 3 están **deshabilitados** por defecto.

## Integraciones — estado real

| Integración | Estado |
|---|---|
| HestiaCP (lectura de disco/dominios) | ✅ Funcional |
| SMTP (mailbox real en `mail.bitlogic.com.ar`) | ✅ Funciona a nivel código. ⚠️ Entrega afectada por falta de registro PTR en el proveedor del VPS (CTL Argentina) — pendiente de su lado |
| MercadoPago (checkout + webhook) | ⚠️ Código completo, falta `MP_ACCESS_TOKEN` real de producción |
| Telegram (avisos de tickets al staff) | ⚠️ Código completo y probado, falta crear el bot y cargar el token |
| WhatsApp (Baileys, recordatorios a clientes) | ⚠️ Código completo, QR de vinculación probado contra WhatsApp real. Apagado hasta vincular el número real de la empresa |

## Bloqueantes conocidos para producción

1. `MP_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`/`CHAT_ID` sin cargar.
2. PTR de la IP del VPS sin configurar por el proveedor (afecta entrega de email).
3. No usar `npm run seed` contra la base de producción — carga datos de demo ficticios. La base real ya tiene datos de negocio cargados localmente; para producción corresponde migrar esa base (`pg_dump`/`pg_restore`), no sembrar desde cero.
4. El webhook de MercadoPago no verifica la firma de la notificación — mitigado parcialmente (se re-consulta el pago real contra la API de MP antes de acreditar nada), pero falta la verificación real de firma. Documentado en el código (`backend/src/routes/mercadopago.routes.js`).
5. El scheduler usa un lock en memoria (`runningJobs`), correcto para 1 sola instancia PM2 (fork, el modo actual). Si en algún momento se escala a más de una instancia, ese lock deja de garantizar exclusión — hace falta un lock en PostgreSQL (`pg_advisory_lock`) antes de escalar.

## Dónde está la documentación

- Este archivo (`docs/PRODUCTION_STATUS.md`): estado funcional y de integraciones vigente.
- `docs/SCHEDULER.md`: horarios, timezone, cómo deshabilitar el scheduler y revisar logs de automatizaciones.
- `DEPLOYMENT_GUIDE.md` (raíz): guía paso a paso de deploy, ya corregida y validada.
- `docs/archive/`: documentación histórica de sesiones de desarrollo — **no usar como referencia**, puede estar desactualizada o contradecir este documento.
