# Deploy en VPS (Hestia + PM2)

Runbook de cómo está desplegado el hub en el VPS. Primer deploy: 31/07/2026.
Mismo servidor y mismo patrón que Bitiando (ver `DEPLOY.md` de ese repo para
más contexto general del servidor).

## Datos del entorno

- **Dominio:** `hub.bitlogic.com.ar`
- **VPS:** panel Hestia, usuario del dominio `santi1962`
- **Carpeta del proyecto:** `/home/santi1962/web/hub.bitlogic.com.ar/app`
- **Node:** vía `nvm` de `root` (¡OJO, distinto del nvm de Bitiando que está
  en `/home/santi1962/web/.nvm`!) — acá se usó
  `/root/.nvm/versions/node/v22.23.2/bin/node`. Confirmar siempre con
  `which node` después de `nvm use 22`.
- **PM2:** corre bajo `root` (mismo PM2 que las otras apps del servidor)
  - `hub-backend` → puerto **3001**, entry point `backend/src/server.js`
  - `hub-frontend` → puerto **3030**, entry point `.output/server/index.mjs`
    (NO `dist/server/server.js` — ver nota de Nitro abajo)
- **Base de datos:** MariaDB vía Hestia
  - DB: `santi1962_hub`, user: `santi1962_hub`
  - Elegir contraseña de DB SOLO alfanumérica (sin `% { ( ! = /` etc.) — ver
    "Problemas ya resueltos" abajo, da muchísimos dolores de cabeza si no.

## Primer deploy / actualizar con commits nuevos

```bash
cd /home/santi1962/web/hub.bitlogic.com.ar/app
source /root/.nvm/nvm.sh   # o el path de nvm que corresponda, confirmar con `which node`
nvm use 22

# Backend
cd backend && npm install

# Schema de DB (solo primera vez / si hay cambios de schema)
npm run db:schema:mariadb -- --url "$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" --confirm-production

# Frontend
cd ..
npm install
npm run build   # genera .output/server/index.mjs (preset node-server)

# Reiniciar procesos
pm2 restart hub-backend hub-frontend
pm2 logs hub-backend --lines 20 --nostream
```

## Puertos ocupados en el servidor

- 3002, 3010, 3011, 4000 → otras apps
- 3020, 4020 → Bitiando (frontend / backend)
- 3001, 3030 → hub (backend / frontend)

## Problemas ya resueltos (por si vuelven a aparecer)

- **`dist/server/server.js` no escucha en ningún puerto (sin logs, sin
  error):** el preset de Nitro por default en `@lovable.dev/vite-tanstack-config`
  es `cloudflare-module` (fetch handler para Cloudflare Workers, no un server
  Node standalone). Hay que forzar el preset en `vite.config.ts`:
  ```ts
  export default defineConfig({
    tanstackStart: { server: { entry: "server" } },
    nitro: { preset: "node-server" },
  });
  ```
  Con esto el build cambia de carpeta: pasa de `dist/server/server.js` a
  `.output/server/index.mjs`, y ESE es el que hay que apuntar en PM2. Lee
  `PORT`/`HOST` de env vars normalmente.
- **`ERROR 1045 Access denied` al correr `db:schema:mariadb` con la
  contraseña correcta (confirmada con login manual):** si el VPS tiene
  `/root/.my.cnf` con credenciales de administración de HestiaCP, esas
  credenciales tienen prioridad sobre `MYSQL_PWD` cuando el cliente
  `mysql`/`mariadb` corre como root — pisa la contraseña silenciosamente. El
  script ya tiene el fix (`--no-defaults` al cliente).
- **Crear este dominio en Hestia regeneró el `nginx.ssl.conf` de Bitiando
  también** (volvió al template default, mostrando "Coming Soon"). Después de
  crear un dominio nuevo en Hestia, revisar TODOS los dominios que bypassean
  Apache, no solo el nuevo — ver DEPLOY.md de Bitiando para el template de
  Nginx a reescribir.
- **`NEXT_PUBLIC_*` / `VITE_*` no toman el valor nuevo con solo reiniciar el
  proceso:** estas variables se inyectan en build time, no en runtime. Hace
  falta re-buildear (frontend de Bitiando y de acá) después de cambiarlas.

## SSO con Bitiando

- `backend/.env`: `BITIANDO_API_URL=https://bitiando.bitlogic.com.ar`
- `.env.local` (frontend, en la raíz del proyecto, NO en `backend/`):
  ```
  VITE_API_BASE_URL=/api
  VITE_BITIANDO_URL=https://bitiando.bitlogic.com.ar
  ```
- Del lado de Bitiando: `backend/.env` necesita `COOKIE_DOMAIN=.bitlogic.com.ar`
  y `frontend/.env.local` necesita `NEXT_PUBLIC_HUB_URL=https://hub.bitlogic.com.ar`
  (y rebuild del frontend de Bitiando, por la misma razón de arriba).
