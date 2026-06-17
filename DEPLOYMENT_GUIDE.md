# DEPLOYMENT GUIDE — Bitlogic Client Hub v1.0.0

**Fecha:** 2026-06-17  
**Versión:** 1.0.0  
**Objetivo:** Deploy en producción en VPS

---

## 📋 PRE-DEPLOYMENT CHECKLIST (LOCAL)

- [x] Frontend build: ✅ OK (1.75s)
- [x] Backend estructura: ✅ OK
- [x] .env protegido: ✅ OK (.gitignore)
- [x] Mocks eliminados: ✅ OK
- [x] Branding finalizado: ✅ OK
- [x] Documentación: ✅ OK

---

## 🚀 FASE 1: GIT & COMMIT (LOCAL)

### Paso 1.1: Agregar todos los cambios
```bash
cd /ruta/a/bitlogic-client-hub-main

# Ver estado
git status

# Agregar todos los cambios (excepto .env)
git add -A
git status  # Verificar que .env NO aparece
```

### Paso 1.2: Commit
```bash
git commit -m "chore: prepare bitlogic client hub for production deploy

- Frontend: branding finalizado, mocks eliminados
- Backend: configurado para PostgreSQL producción
- Build: 0 errores, listo para deploy
- Deployment: scripts y configuración Nginx listos
- Versión: 1.0.0"
```

### Paso 1.3: Subir a GitHub
```bash
# Configurar remote (si no existe)
git remote add origin https://github.com/TU_USUARIO/bitlogic-client-hub.git

# Subir rama main
git branch -M main
git push -u origin main
```

**Verificar en GitHub:**
- ✅ Repo privado (si tiene datos sensibles)
- ✅ main branch actualizado
- ✅ .env NO aparece en el repo

---

## 🖥️ FASE 2: PREPARACIÓN EN VPS

### Paso 2.1: Conectar al VPS
```bash
# SSH a tu VPS
ssh root@tu-vps-ip
# o si usas usuario específico:
ssh usuario@tu-vps-ip
```

### Paso 2.2: Preparar directorios
```bash
# Como root o con sudo

# Crear usuario app (si no existe)
useradd -m -s /bin/bash bitlogic 2>/dev/null || echo "Usuario existe"

# Crear directorios de aplicación
mkdir -p /home/bitlogic/apps
mkdir -p /home/bitlogic/apps/bitlogic-client-hub
mkdir -p /home/bitlogic/apps/bitlogic-client-hub/logs

# Permisos
chown -R bitlogic:bitlogic /home/bitlogic/apps

# Cambiar a usuario bitlogic
su - bitlogic
```

### Paso 2.3: Instalar dependencias del sistema (como root)
```bash
# Si es primera vez
apt-get update
apt-get install -y curl wget git

# Node.js (si no existe)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# PM2 (global)
npm install -g pm2

# Nginx (si no existe)
apt-get install -y nginx

# PostgreSQL (si es primera vez)
apt-get install -y postgresql postgresql-contrib

# Certbot para SSL
apt-get install -y certbot python3-certbot-nginx
```

---

## 📦 FASE 3: CLONAR REPO E INSTALAR

### Paso 3.1: Clonar repo
```bash
cd /home/bitlogic/apps/bitlogic-client-hub

# Clonar (como usuario bitlogic)
git clone https://github.com/TU_USUARIO/bitlogic-client-hub.git .

# o si ya existe:
git pull origin main
```

### Paso 3.2: Instalar dependencias frontend
```bash
cd /home/bitlogic/apps/bitlogic-client-hub

npm ci  # Usar package-lock.json exacto
```

### Paso 3.3: Instalar dependencias backend
```bash
cd /home/bitlogic/apps/bitlogic-client-hub/backend

npm ci
```

---

## 🔐 FASE 4: CONFIGURACIÓN DE SECRETOS

### Paso 4.1: Crear .env backend (PRODUCCIÓN)
```bash
cd /home/bitlogic/apps/bitlogic-client-hub/backend

# Copiar template
cp .env.production.example .env.production

# Editar con valores reales
nano .env.production
```

**Contenido .env.production:**
```env
# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bitlogic_prod
DB_USER=bitlogic_user
DB_PASSWORD=CONTRASEÑA_SEGURA_AQUÍ
DB_POOL_SIZE=20

# JWT
JWT_SECRET=CLAVE_SECRETA_LARGA_AQUÍ
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=OTRA_CLAVE_SECRETA_AQUÍ
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_FROM=noreply@bitlogic.com.ar

# Frontend URL
FRONTEND_URL=https://clientes.bitlogic.com.ar

# Hestia
HESTIA_URL=https://tu-hestia-url.com
HESTIA_USER=admin-user
HESTIA_PASS=admin-password

# App
APP_NAME=Bitlogic Client Hub
APP_VERSION=1.0.0
LOG_LEVEL=info
```

**⚠️ IMPORTANTE:**
- Usar contraseñas SEGURAS y COMPLEJAS
- Generar con: `openssl rand -base64 32`
- Nunca compartir estos valores
- Backup de .env.production en lugar seguro

### Paso 4.2: Crear .env frontend (PRODUCCIÓN)
```bash
cd /home/bitlogic/apps/bitlogic-client-hub

# Crear .env.production
cat > .env.production << 'EOF'
VITE_API_BASE_URL=https://api-clientes.bitlogic.com.ar/api
VITE_ENV=production
EOF
```

---

## 🗄️ FASE 5: BASE DE DATOS

### Paso 5.1: Crear usuario y BD PostgreSQL (como root)
```bash
sudo -u postgres psql << 'SQL'
-- Crear usuario
CREATE USER bitlogic_user WITH PASSWORD 'CONTRASEÑA_AQUÍ';

-- Crear BD
CREATE DATABASE bitlogic_prod OWNER bitlogic_user;

-- Permisos
GRANT CONNECT ON DATABASE bitlogic_prod TO bitlogic_user;
GRANT CREATE ON DATABASE bitlogic_prod TO bitlogic_user;
\c bitlogic_prod
GRANT ALL ON SCHEMA public TO bitlogic_user;

SQL
```

### Paso 5.2: Ejecutar migraciones
```bash
cd /home/bitlogic/apps/bitlogic-client-hub/backend

# Asegurar que NODE_ENV=production
export NODE_ENV=production

# Ejecutar migraciones
npm run migrate

# NOTA: NO ejecutar seed en producción (solo datos reales)
# npm run seed — NO ejecutar esto
```

---

## ⚙️ FASE 6: BUILD FRONTEND

### Paso 6.1: Build producción
```bash
cd /home/bitlogic/apps/bitlogic-client-hub

# Build
npm run build

# Verificar
ls -la dist/
# Debe existir dist/client/ y dist/server/
```

### Paso 6.2: Copiar archivos estáticos
```bash
# El build ya genera todo en dist/
# No hay que copiar nada manualmente
```

---

## 🔄 FASE 7: PM2 (PROCESS MANAGER)

### Paso 7.1: Crear ecosystem.config.js
```bash
cd /home/bitlogic/apps/bitlogic-client-hub

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'bitlogic-backend',
      script: './backend/src/server.js',
      cwd: '/home/bitlogic/apps/bitlogic-client-hub',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      ignore_watch: ['node_modules', 'dist', 'logs'],
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'bitlogic-frontend',
      script: './dist/server/index.js',
      cwd: '/home/bitlogic/apps/bitlogic-client-hub',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    }
  ]
};
EOF
```

### Paso 7.2: Iniciar con PM2
```bash
# Cargar configuración
pm2 start ecosystem.config.js --env production

# Salvar configuración
pm2 save

# Configurar para arrancar al boot
pm2 startup systemd -u bitlogic --hp /home/bitlogic
pm2 save
```

### Paso 7.3: Verificar estado
```bash
pm2 status
pm2 logs bitlogic-backend
pm2 logs bitlogic-frontend
```

---

## 🌐 FASE 8: NGINX CONFIGURATION

### Paso 8.1: Crear configuración Nginx (como root)
```bash
# Frontend: clientes.bitlogic.com.ar
cat > /etc/nginx/sites-available/clientes.bitlogic.com.ar << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name clientes.bitlogic.com.ar;

    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name clientes.bitlogic.com.ar;

    # SSL (agregado por certbot)
    ssl_certificate /etc/letsencrypt/live/clientes.bitlogic.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clientes.bitlogic.com.ar/privkey.pem;

    # Seguridad
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;

    # Frontend (TanStack Router SSR)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Logs
    access_log /var/log/nginx/clientes.bitlogic.com.ar-access.log;
    error_log /var/log/nginx/clientes.bitlogic.com.ar-error.log;
}
EOF

# Backend: api-clientes.bitlogic.com.ar
cat > /etc/nginx/sites-available/api-clientes.bitlogic.com.ar << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api-clientes.bitlogic.com.ar;

    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api-clientes.bitlogic.com.ar;

    # SSL
    ssl_certificate /etc/letsencrypt/live/api-clientes.bitlogic.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-clientes.bitlogic.com.ar/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # API Backend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://clientes.bitlogic.com.ar' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }

    access_log /var/log/nginx/api-clientes.bitlogic.com.ar-access.log;
    error_log /var/log/nginx/api-clientes.bitlogic.com.ar-error.log;
}
EOF
```

### Paso 8.2: Habilitar sitios
```bash
# Crear symlinks
ln -s /etc/nginx/sites-available/clientes.bitlogic.com.ar /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api-clientes.bitlogic.com.ar /etc/nginx/sites-enabled/

# Remover default
rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# Verificar sintaxis
nginx -t

# Recargar Nginx
systemctl reload nginx
```

---

## 🔒 FASE 9: SSL CON CERTBOT

### Paso 9.1: Certificados SSL (como root)
```bash
# Frontend
certbot certonly --nginx -d clientes.bitlogic.com.ar

# Backend
certbot certonly --nginx -d api-clientes.bitlogic.com.ar

# Renovación automática
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

## ✅ FASE 10: PRUEBAS FINALES

### Paso 10.1: Verificar servicios
```bash
# Estado PM2
pm2 status

# Logs
pm2 logs bitlogic-backend --lines 20
pm2 logs bitlogic-frontend --lines 20

# Nginx
systemctl status nginx

# PostgreSQL
sudo -u postgres psql -l | grep bitlogic
```

### Paso 10.2: Pruebas HTTP
```bash
# API health
curl -X GET https://api-clientes.bitlogic.com.ar/api/health

# Frontend
curl -I https://clientes.bitlogic.com.ar
# Debe devolver 200

# Redirect HTTP to HTTPS
curl -I http://clientes.bitlogic.com.ar
# Debe devolver 301
```

### Paso 10.3: Pruebas en navegador
1. Abrir https://clientes.bitlogic.com.ar
2. Login con usuario admin
3. Verificar Dashboard cargue sin errores
4. Verificar API calls a https://api-clientes.bitlogic.com.ar/api/*
5. Verificar que NO haya datos mock visibles
6. Verificar HTTPS válido (candadito en navegador)

---

## 🔧 TROUBLESHOOTING

### Si API devuelve error 502
```bash
# Verificar que PM2 está corriendo
pm2 status

# Ver logs del backend
pm2 logs bitlogic-backend

# Verificar que Puerto 3001 está escuchando
lsof -i :3001

# Reiniciar backend
pm2 restart bitlogic-backend
```

### Si Frontend no carga
```bash
# Verificar logs frontend
pm2 logs bitlogic-frontend

# Verificar puerto 3000
lsof -i :3000

# Verificar Nginx
tail -f /var/log/nginx/clientes.bitlogic.com.ar-error.log
```

### Si BD falla
```bash
# Conectar a PostgreSQL
sudo -u postgres psql -d bitlogic_prod

# Ver tablas
\dt

# Ver conexiones activas
SELECT * FROM pg_stat_activity;
```

### Si SSL falla
```bash
# Verificar certificados
ls -la /etc/letsencrypt/live/

# Renovar manual
certbot renew --force-renewal
```

---

## 📊 POST-DEPLOY CHECKLIST

- [ ] ✅ Frontend en https://clientes.bitlogic.com.ar
- [ ] ✅ API en https://api-clientes.bitlogic.com.ar/api/health (200 OK)
- [ ] ✅ Login funciona
- [ ] ✅ Dashboard cargue con datos reales
- [ ] ✅ NO hay datos mock visibles (Estudio Acosta, etc.)
- [ ] ✅ Logo visible en tab y sidebar
- [ ] ✅ SSL válido (sin advertencias)
- [ ] ✅ PM2 en estado online (todos los procesos)
- [ ] ✅ BD PostgreSQL conectada
- [ ] ✅ Logs no muestran errores críticos

---

## 📝 REFERENCIAS RÁPIDAS

**Útiles en VPS:**
```bash
# Ver espacho en disco
df -h

# Ver uso de memoria
free -h

# Tail logs en tiempo real
tail -f /home/bitlogic/apps/bitlogic-client-hub/logs/*.log

# Reiniciar todo
pm2 restart all

# Ver logs del día
journalctl -u postgresql --since today
```

---

**Última actualización:** 2026-06-17  
**Versión de guía:** 1.0.0  
**Estado:** ✅ LISTA PARA EJECUTAR
