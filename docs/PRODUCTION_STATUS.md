# Bitlogic Client Hub — Estado de producción

**Última actualización:** 2026-07-16
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

**Excepción importante:** el módulo de Automatizaciones (recordatorios de pago, sync de Hestia, detección de morosidad) tiene los jobs implementados pero **sin disparador automático real** — hoy solo se ejecutan si un usuario los corre a mano desde el panel. Esto es un bloqueante funcional conocido, no un bug de código.

## Integraciones — estado real

| Integración | Estado |
|---|---|
| HestiaCP (lectura de disco/dominios) | ✅ Funcional |
| SMTP (mailbox real en `mail.bitlogic.com.ar`) | ✅ Funciona a nivel código. ⚠️ Entrega afectada por falta de registro PTR en el proveedor del VPS (CTL Argentina) — pendiente de su lado |
| MercadoPago (checkout + webhook) | ⚠️ Código completo, falta `MP_ACCESS_TOKEN` real de producción |
| Telegram (avisos de tickets al staff) | ⚠️ Código completo y probado, falta crear el bot y cargar el token |
| WhatsApp (Baileys, recordatorios a clientes) | ⚠️ Código completo, QR de vinculación probado contra WhatsApp real. Apagado hasta vincular el número real de la empresa |

## Bloqueantes conocidos para producción

1. Repositorio sin remote configurado — resolver antes de poder deployar de forma reproducible.
2. Automatizaciones sin disparador real (ver arriba).
3. `MP_ACCESS_TOKEN`, `TELEGRAM_BOT_TOKEN`/`CHAT_ID` sin cargar.
4. PTR de la IP del VPS sin configurar por el proveedor (afecta entrega de email).
5. No usar `npm run seed` contra la base de producción — carga datos de demo ficticios. La base real ya tiene datos de negocio cargados localmente; para producción corresponde migrar esa base (`pg_dump`/`pg_restore`), no sembrar desde cero.

## Dónde está la documentación

- Este archivo (`docs/PRODUCTION_STATUS.md`): estado funcional y de integraciones vigente.
- `DEPLOYMENT_GUIDE.md` (raíz): guía paso a paso de deploy, ya corregida y validada.
- `docs/archive/`: documentación histórica de sesiones de desarrollo — **no usar como referencia**, puede estar desactualizada o contradecir este documento.
