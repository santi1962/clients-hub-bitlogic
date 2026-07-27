# DEPLOY CHECKLIST — Bitlogic Client Hub en VPS

## Pre-Deploy (7 días antes)

- [ ] **Copia de seguridad completa** del sistema actual
- [ ] Validar que staging env funciona 100%
- [ ] Verificar que todos los datos se sincronizaron desde prod
- [ ] Confirmar dominios DNS están preparados
  - [ ] clientes.bitlogic.com.ar
  - [ ] api-clientes.bitlogic.com.ar
- [ ] Preparar certificados SSL (Let's Encrypt)
- [ ] Revisar DEPLOYMENT.md y .env.production.example
- [ ] Generar contraseñas/secrets aleatorios fuertes

## Day 0: Preparación de Infraestructura (4 horas antes)

### 1. Conectarse al VPS
```bash
ssh root@your-vps-ip
```

### 2. Actualizar sistema
```bash
apt-get update
apt-get upgrade -y
```

### 3. Instalar Node.js 20+
```bash
curl -sL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version    # v20.x.x
npm --version     # 10.x.x
```

### 4. Instalar PM2 globalmente
```bash
npm install -g pm2
pm2 startup
pm2 save
```

### 5. Instalar PostgreSQL 14+
```bash
apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verificar
sudo -u postgres psql --version
```

### 6. Instalar Nginx
```bash
apt-get install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 7. Instalar Certbot (SSL)
```bash
apt-get install -y certbot python3-certbot-nginx
```

### 8. Crear usuario de deploy (opcional pero recomendado)
```bash
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
su - deploy
```

## Day 1: Despliegue Principal (morning)

### 1. Preparar Base de Datos
```bash
# Como root o con sudo
sudo -u postgres psql

# En psql:
CREATE USER bitlogic_user WITH PASSWORD 'STRONG_PASSWORD_CHANGE_ME';
CREATE DATABASE bitlogic_prod OWNER bitlogic_user;
GRANT ALL PRIVILEGES ON DATABASE bitlogic_prod TO bitlogic_user;
\q
```

### 2. Clonar repositorio
```bash
cd /var/www
git clone https://github.com/your-org/bitlogic-client-hub.git
cd bitlogic-client-hub
```

### 3. Configurar variables de entorno
```bash
# Backend
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
# Actualizar:
#  - DATABASE_URL
#  - JWT_ACCESS_SECRET (generar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#  - JWT_REFRESH_SECRET
#  - SMTP_HOST, SMTP_USER, SMTP_PASS
#  - HESTIA_API_URL, HESTIA_API_KEY
#  - CORS_ORIGIN=https://clientes.bitlogic.com.ar

chmod 600 backend/.env.production

# Frontend
cat > .env.production << EOF
VITE_API_BASE_URL=https://api-clientes.bitlogic.com.ar/api
EOF
```

### 4. Instalar dependencias
```bash
npm ci --omit=dev
cd backend
npm ci --omit=dev
cd ..
```

### 5. Build frontend
```bash
npm run build
# Verificar que existe dist/
ls -la dist/
```

### 6. Ejecutar migraciones
```bash
cd backend
NODE_ENV=production npm run migrate
# ✓ 001_auth_schema.sql
# ✓ 002_core_hosting_schema.sql
# ... (todas las migraciones)
cd ..
```

### 7. Ejecutar seed inicial (si es primera vez)
```bash
# Opcional - solo si necesita datos iniciales
cd backend
NODE_ENV=production npm run seed
cd ..
```

### 8. Iniciar backend con PM2
```bash
pm2 start ecosystem.config.js --env production --update-env
pm2 save

# Verificar
pm2 status
pm2 logs backend
```

### 9. Preparar directorios Nginx
```bash
sudo mkdir -p /var/www/bitlogic-client-hub/dist
sudo cp -r dist/* /var/www/bitlogic-client-hub/dist/
sudo chown -R www-data:www-data /var/www/bitlogic-client-hub
```

### 10. Configurar Nginx
```bash
# Backend API
sudo cp nginx/api-clientes.bitlogic.com.ar.conf \
    /etc/nginx/sites-available/api-clientes.bitlogic.com.ar
sudo ln -s /etc/nginx/sites-available/api-clientes.bitlogic.com.ar \
    /etc/nginx/sites-enabled/

# Frontend
sudo cp nginx/clientes.bitlogic.com.ar.conf \
    /etc/nginx/sites-available/clientes.bitlogic.com.ar
sudo ln -s /etc/nginx/sites-available/clientes.bitlogic.com.ar \
    /etc/nginx/sites-enabled/

# Verificar sintaxis
sudo nginx -t
# Si OK: recargar
sudo systemctl reload nginx
```

### 11. Obtener certificados SSL
```bash
# Backend API
sudo certbot certonly --nginx -d api-clientes.bitlogic.com.ar
# Elegir opción 1 (standalone) o 2 (nginx)

# Frontend
sudo certbot certonly --nginx -d clientes.bitlogic.com.ar

# Recargar Nginx con SSL
sudo systemctl reload nginx
```

### 12. Verificar health endpoints
```bash
# Health check backend
curl https://api-clientes.bitlogic.com.ar/api/health

# Sistema status
curl https://api-clientes.bitlogic.com.ar/api/system/status

# Frontend
curl https://clientes.bitlogic.com.ar
```

### 13. Configurar backups automáticos
```bash
# Hacer ejecutable
chmod +x scripts/backup-db.sh

# Agregar a cron
sudo crontab -e

# Agregar línea:
# 0 2 * * * /var/www/bitlogic-client-hub/scripts/backup-db.sh >> /var/log/bitlogic-backup.log 2>&1
```

## Post-Deploy (Day 1 evening)

### 1. Verificaciones básicas
```bash
# [ ] Backend está online
pm2 status

# [ ] Nginx responde
curl -I https://clientes.bitlogic.com.ar
curl -I https://api-clientes.bitlogic.com.ar/api/health

# [ ] Base de datos conecta
psql -U bitlogic_user -d bitlogic_prod -c "SELECT COUNT(*) FROM clients;"

# [ ] SSL válido
sudo certbot certificates
```

### 2. Test de login
- [ ] Acceder a https://clientes.bitlogic.com.ar
- [ ] Login con admin@bitlogic.com.ar / Cambiar123!
- [ ] Verificar que puede navegar páginas
- [ ] Check console (F12) para errores

### 3. Test de funcionalidad core
- [ ] Ver dashboard (/admin)
- [ ] Ver clientes (/admin/clientes)
- [ ] Ver avisos (/admin/pagos)
- [ ] Ver automatizaciones (/admin/automatizaciones)
- [ ] Ejecutar job de diagnóstico (/admin/diagnostico)

### 4. Test de API
```bash
TOKEN="eyJ..." # obtener token de login
curl -H "Authorization: Bearer $TOKEN" \
    https://api-clientes.bitlogic.com.ar/api/system/status
```

### 5. Monitoreo de logs
```bash
# Cada terminal en una ventana separada:

# Terminal 1: Backend logs
pm2 logs backend

# Terminal 2: Nginx access
tail -f /var/log/nginx/clientes.bitlogic.com.ar.access.log

# Terminal 3: Nginx errors
tail -f /var/log/nginx/clientes.bitlogic.com.ar.error.log

# Terminal 4: PM2 monitor
pm2 monit
```

## Production Day-to-Day

### Comandos útiles

```bash
# Estado de aplicación
pm2 status
pm2 list

# Ver logs
pm2 logs backend
pm2 logs backend --err
pm2 logs backend --lines 100

# Monitorear recursos
pm2 monit

# Restart (sin downtime si tienes múltiples instancias)
pm2 reload backend

# Graceful restart
pm2 restart backend --wait-ready

# Ver configuración del app
pm2 show backend
```

### Certificados SSL

```bash
# Renovar (certbot lo hace automáticamente, pero puede forzarse)
sudo certbot renew --dry-run
sudo certbot renew

# Ver estado
sudo certbot certificates
```

### Backups

```bash
# Backup manual
/var/www/bitlogic-client-hub/scripts/backup-db.sh daily

# Listar backups
ls -lh /var/backups/bitlogic/

# Restaurar desde backup
pg_restore -Fc -d bitlogic_prod /var/backups/bitlogic/bitlogic_prod_YYYYMMDD_HHMMSS.dump
```

### Actualizar código (deploy)

```bash
cd /var/www/bitlogic-client-hub

# Opción 1: Usar script (recomendado)
./scripts/deploy.sh production

# Opción 2: Manual
git pull origin main
npm ci --omit=dev
cd backend && npm ci --omit=dev && cd ..
npm run build
NODE_ENV=production npm run migrate
pm2 restart backend
```

## Troubleshooting

### Backend no inicia

```bash
# Verificar logs
pm2 logs backend

# Error común: database connection
# Solución: verificar DATABASE_URL en .env.production
psql -U bitlogic_user -d bitlogic_prod -c "SELECT 1;"

# Error común: port already in use
lsof -i :3001
# kill -9 <PID>

# Restart backend
pm2 restart backend
```

### Nginx 502 Bad Gateway

```bash
# Backend caído
pm2 status

# Verificar proxy
curl http://localhost:3001/api/health

# Verificar configuración
sudo nginx -t
sudo systemctl reload nginx
```

### Database permission denied

```bash
# Verificar usuario
psql -U bitlogic_user -d bitlogic_prod -c "\l"

# Si no funciona, recrear:
sudo -u postgres dropuser bitlogic_user
sudo -u postgres dropdb bitlogic_prod
# ... y volver a crear (ver section "Preparar Base de Datos")
```

## Seguridad - Checklist Final

- [ ] .env.production NO está en .gitignore (verificar: git status)
- [ ] Permisos correctos en archivos sensibles: `chmod 600 backend/.env.production`
- [ ] Firewall configurado (solo puertos 80, 443 públicos)
- [ ] SSH hardening (keys only, no password login)
- [ ] Cambiar contraseña root/admin
- [ ] Desactivar root login via SSH
- [ ] Backup automático configurado
- [ ] Monitoreo de logs configurado
- [ ] Rate limiting en Nginx activo
- [ ] HTTPS enforced (no HTTP)
- [ ] CORS configurado correctamente (no allow-all)
- [ ] Secrets rotatados (Hestia API key, JWT secrets)
- [ ] Backups testeados (intentar restaurar una vez)

## Rollback Plan

Si algo sale mal después de deploy:

```bash
# 1. Parar backend
pm2 stop backend

# 2. Revertir código
cd /var/www/bitlogic-client-hub
git log --oneline | head  # ver último commit
git revert HEAD           # crear nuevo commit que deshace cambios
# o
git reset --hard <commit-anterior>

# 3. Reinstalar dependencias
npm ci --omit=dev
cd backend && npm ci --omit=dev && cd ..

# 4. Rebuild frontend
npm run build

# 5. Restaurar database (si necesario)
pg_restore -Fc -d bitlogic_prod /var/backups/bitlogic/bitlogic_prod_<timestamp>.dump

# 6. Reiniciar
pm2 restart backend
pm2 logs backend  # verificar que inicia
```

## Contacto y Escalation

- **Issue crítico (sitio down):** `pm2 logs backend` → revisar error
- **Database corrupt:** restaurar último backup
- **SSL expirado:** `sudo certbot renew`
- **Memoria agotada:** `pm2 restart backend` (y revisar memory leaks)

---

**Última actualización:** 2026-06-17
**Status:** ✅ Ready for Production
