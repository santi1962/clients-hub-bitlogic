# BITLOGIC CLIENT HUB — Guía de Despliegue en VPS

## Arquitectura Producción

```
┌─────────────────────────────────────────────────────────────────┐
│                      INTERNET (HTTPS)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    FIREWALL / DNS                               │
│  clientes.bitlogic.com.ar    → Nginx (puerto 443)              │
│  api-clientes.bitlogic.com.ar → Nginx (puerto 443)             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                        │
│  ┌────────────────────────┐  ┌──────────────────────────┐      │
│  │ clientes.* → localhost:3000 (Frontend)              │      │
│  │ api-clientes.* → localhost:3001 (Backend API)       │      │
│  └────────────────────────┘  └──────────────────────────┘      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼────────┐  ┌───▼──────────┐
│   FRONTEND   │  │  BACKEND API  │  │  PostgreSQL  │
│   (dist/)    │  │  (Node/PM2)   │  │  (puerto     │
│   puerto     │  │  puerto 3001  │  │   5432)      │
│   3000       │  │               │  │              │
│   (opcional) │  │               │  │              │
└──────────────┘  └───────────────┘  └──────────────┘
                        │
                  ┌─────▴─────┐
                  │           │
            ┌────▼──┐   ┌────▼──┐
            │ Logs  │   │Backups│
            │(/var) │   │(AWS)  │
            └───────┘   └───────┘
```

## Stack Tecnológico

### Frontend
- **Framework:** React 18 + TanStack Router
- **Build:** Vite
- **Output:** SPA estática en `dist/`
- **Servido por:** Nginx

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express
- **Process Manager:** PM2
- **Database:** PostgreSQL 14+
- **Authentication:** JWT (header Authorization)
- **Email:** SMTP (Mailtrap/SendGrid)

### Infraestructura
- **OS:** Linux (Hestia)
- **Web Server:** Nginx
- **Database:** PostgreSQL
- **Process Manager:** PM2
- **SSL:** Let's Encrypt (certbot)
- **Backups:** pg_dump + AWS S3

## Dominios Recomendados

```
panel.bitlogic.com.ar           → HestiaCP (no cambia)
clientes.bitlogic.com.ar        → Frontend SPA (Nginx)
api-clientes.bitlogic.com.ar    → Backend API (Nginx → localhost:3001)
```

## Variables de Entorno

### Backend (.env.production)

```env
# === CORE ===
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://clientes.bitlogic.com.ar

# === DATABASE ===
DATABASE_URL=postgresql://bitlogic_user:STRONG_PASSWORD@localhost:5432/bitlogic_prod

# === JWT ===
JWT_ACCESS_SECRET=your-secret-key-min-32-chars-CHANGE-THIS
JWT_REFRESH_SECRET=your-refresh-key-min-32-chars-CHANGE-THIS
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# === SMTP ===
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
SMTP_FROM_NAME=Bitlogic
SMTP_FROM_EMAIL=noreply@bitlogic.com.ar

# === HESTIA ===
HESTIA_API_URL=https://panel.bitlogic.com.ar:8083
HESTIA_API_KEY=your-hestia-api-key-CHANGE-THIS
HESTIA_VERIFY_SSL=true
```

### Frontend (.env.production)

```env
VITE_API_BASE_URL=https://api-clientes.bitlogic.com.ar/api
```

## Puertos

| Puerto | Servicio | Público | Notas |
|--------|----------|---------|-------|
| 80 | HTTP (redirect a 443) | Sí | HTTP → HTTPS |
| 443 | HTTPS (Nginx) | Sí | Todo tráfico |
| 3000 | Frontend (Express) | No | Nginx reverse proxy |
| 3001 | Backend (Node) | No | Nginx reverse proxy |
| 5432 | PostgreSQL | No | Localhost solamente |

## Nginx Configuration

### Backend Reverse Proxy

```nginx
# /etc/nginx/sites-available/api-clientes.bitlogic.com.ar

server {
    listen 443 ssl http2;
    server_name api-clientes.bitlogic.com.ar;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api-clientes.bitlogic.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-clientes.bitlogic.com.ar/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Reverse proxy to Node backend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name api-clientes.bitlogic.com.ar;
    return 301 https://$server_name$request_uri;
}
```

### Frontend SPA

```nginx
# /etc/nginx/sites-available/clientes.bitlogic.com.ar

server {
    listen 443 ssl http2;
    server_name clientes.bitlogic.com.ar;

    root /var/www/bitlogic-client-hub/dist;
    index index.html;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/clientes.bitlogic.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clientes.bitlogic.com.ar/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # SPA routing (todos los requests a index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Assets con cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP redirect
server {
    listen 80;
    server_name clientes.bitlogic.com.ar;
    return 301 https://$server_name$request_uri;
}
```

## PM2 Configuration

Ver `ecosystem.config.js` en raíz del proyecto.

Comandos principales:
```bash
# Iniciar
pm2 start ecosystem.config.js --env production

# Monitorear
pm2 monit

# Logs
pm2 logs backend

# Reiniciar
pm2 restart backend

# Status
pm2 status
```

## PostgreSQL Setup

### 1. Crear usuario y base de datos

```bash
sudo -u postgres psql

CREATE USER bitlogic_user WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE bitlogic_prod OWNER bitlogic_user;
GRANT ALL PRIVILEGES ON DATABASE bitlogic_prod TO bitlogic_user;
```

### 2. Ejecutar migraciones

```bash
cd /var/www/bitlogic-client-hub/backend
NODE_ENV=production npm run migrate
```

### 3. Opcional: Seed datos iniciales

```bash
NODE_ENV=production npm run seed
```

## SSL/TLS (Let's Encrypt)

```bash
# Instalar certbot
sudo apt-get install certbot python3-certbot-nginx

# Crear certificados
sudo certbot certonly --nginx -d clientes.bitlogic.com.ar
sudo certbot certonly --nginx -d api-clientes.bitlogic.com.ar

# Auto-renovación (check cada 12h)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Seguridad - Checklist Pre-Producción

- [ ] Cambiar todas las variables de .env.production (SMTP, JWT, Hestia API key)
- [ ] Usar HTTPS en CORS_ORIGIN
- [ ] Desactivar debug logs en NODE_ENV=production
- [ ] Configurar firewall (solo 80, 443)
- [ ] Cambiar contraseña PostgreSQL
- [ ] Habilitar SSL en PostgreSQL si es remota
- [ ] Configurar backups automáticos (diarios)
- [ ] Monitorear logs: `/var/log/pm2/`
- [ ] Configurar rate limiting en Nginx
- [ ] Desactivar X-Powered-By header
- [ ] Configurar CORS correcto (no allow-all)
- [ ] Rotar Hestia API key mensualmente
- [ ] Hacer backup de .env.production en lugar seguro
- [ ] Documentar procedimiento de restauración

## Backups

### PostgreSQL automático (cron)

```bash
# /etc/cron.d/bitlogic-backup

0 2 * * * postgres pg_dump -Fc bitlogic_prod > /backup/bitlogic_$(date +\%Y\%m\%d_\%H\%M\%S).dump

# Retener últimos 30 días
0 3 * * * find /backup -name "bitlogic_*.dump" -mtime +30 -delete
```

### Restaurar desde backup

```bash
pg_restore -Fc -d bitlogic_prod /backup/bitlogic_YYYYMMDD_HHMMSS.dump
```

## Deploy Workflow

1. **En dev:** test completo, commits a main
2. **En VPS:** pull main, rebuild frontend, restart backend con PM2
3. **Post-deploy:** sanity checks (login, datos, APIs)
4. **Rollback:** git revert, rebuild, restart

Ver `scripts/deploy.sh` para automatización.

## Logs y Monitoreo

### Backend logs
```bash
pm2 logs backend
tail -f /var/log/pm2/backend-error.log
```

### Nginx logs
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### PostgreSQL logs
```bash
tail -f /var/log/postgresql/postgresql.log
```

## Performance Tuning

### Node.js
```bash
# Usar múltiples cores con PM2
instances: "max"  # en ecosystem.config.js
```

### Nginx
```nginx
worker_processes auto;
worker_connections 2048;
```

### PostgreSQL
```sql
-- Configurar en /etc/postgresql/postgresql.conf
shared_buffers = 256MB
work_mem = 64MB
maintenance_work_mem = 64MB
```

## Troubleshooting

### Backend no responde
```bash
pm2 status
pm2 restart backend
pm2 logs backend
```

### Nginx: 502 Bad Gateway
```bash
# Backend caído
pm2 status
# Nginx upstream no encontrado
sudo nginx -t
sudo systemctl restart nginx
```

### Database connection refused
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql
# Conectar directamente
psql -U bitlogic_user -d bitlogic_prod
```

### CORS errors
- Verificar CORS_ORIGIN en .env.production
- Verificar host en navegador (https)
- Restart backend: `pm2 restart backend`

## Contacto y Soporte

Para issues en producción:
1. Revisar logs (backend, nginx, postgres)
2. Revisar health endpoint: `curl https://api-clientes.bitlogic.com.ar/api/health`
3. Restart servicios si es necesario
4. Último recurso: rollback deploy anterior

---

**Última actualización:** 2026-06-17
**Versión:** 1.0.0
