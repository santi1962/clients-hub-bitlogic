# LOCAL DEV SETUP — Bitlogic Client Hub

**Para correr con datos reales en tu máquina:**

---

## Opción 1: PostgreSQL Instalado Localmente (RECOMENDADO)

### 1. Instalar PostgreSQL
- Descargar desde https://www.postgresql.org/download/windows/
- Instalar con puerto 5432, usuario `postgres`, contraseña segura
- Verificar: `psql --version`

### 2. Crear base de datos
```bash
psql -U postgres -c "CREATE DATABASE bitlogic_dev;"
```

### 3. Configurar .env.development en backend/
```bash
cd backend
cat > .env.development << 'EOF'
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/bitlogic_dev
JWT_SECRET=dev-secret-key-123456789
REFRESH_TOKEN_SECRET=dev-refresh-secret-123456
HESTIA_URL=https://hestia.bitlogic.com.ar:8083
HESTIA_USER=admin
HESTIA_PASS=test-password
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
FRONTEND_URL=http://localhost:5173
EOF
```

### 4. Ejecutar migraciones
```bash
cd backend
npm run migrate
```

### 5. Crear datos de prueba
```bash
cd backend
npm run seed
```

### 6. Levantar servicios
```bash
# Terminal 1: Backend
cd backend
npm run dev
# Debe mostrar: ✓ PostgreSQL conectado

# Terminal 2: Frontend
npm run dev
# Deberá mostrar: Vite dev server running at http://localhost:5173
```

### 7. Acceder
```
Frontend: http://localhost:5173
API: http://localhost:3001/api
Login: (datos de seed)
```

---

## Opción 2: Docker Compose (MÁS RÁPIDO)

### 1. Crear docker-compose.yml
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bitlogic_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 2. Iniciar
```bash
docker-compose up -d
```

### 3. Seguir pasos 3-7 de Opción 1

---

## Opción 3: Datos Mock EN MEMORIA (NO DATA REAL)

Si quieres ver la UI pero no tienes BD:

### 1. Backend usa mock data
El backend ya tiene un archivo `src/seeds/seed.js` que puede usar datos en memoria.

### 2. Configurar
```bash
cd backend
echo "DATABASE_URL=mock://in-memory" > .env.development
npm run dev
# Servidor levantará CON datos mock en memoria
```

⚠️ **NOTA:** Esta opción NO usa datos reales de PostgreSQL.

---

## Troubleshooting

### "Error: connect ECONNREFUSED"
PostgreSQL no está corriendo.
```bash
# Windows: Verificar servicios
services.msc → PostgreSQL → Iniciar

# WSL2: Instalar PostgreSQL en WSL
sudo apt-get install postgresql postgresql-contrib
```

### "Error: database "bitlogic_dev" does not exist"
```bash
psql -U postgres -c "CREATE DATABASE bitlogic_dev;"
```

### "Error: relation doesn't exist"
Migraciones no corrieron:
```bash
cd backend
npm run migrate
```

### Frontend no conecta a API
```bash
# Verificar que backend esté corriendo:
curl http://localhost:3001/api/health
# Debe devolver 200 OK
```

---

## Comandos Útiles

```bash
# Ver logs PostgreSQL
tail -f /var/log/postgresql/postgresql.log  # Linux/WSL

# Resetear BD (CUIDADO: borra todo)
cd backend && npm run reset

# Ver datos en BD
psql -d bitlogic_dev -c "SELECT * FROM clients;"

# Ver API en desarrollo
curl http://localhost:3001/api/health
curl http://localhost:3001/api/clients
```

---

## ¿Cuál elegir?

| Opción | Pros | Contras | Para |
|--------|------|---------|------|
| **PostgreSQL Local** | Datos REALES, persistente | Instalación manual | Desarrollo serio |
| **Docker** | Setup rápido, limpio | Requiere Docker | Desarrollo casual |
| **Mock Memory** | Cero setup | NO datos reales | Demo/testing UI |

**Recomendación:** Docker es el más rápido si lo tienes instalado.

---

**Cuando esté corriendo:**
- Frontend: http://localhost:5173
- API: http://localhost:3001/api
- Dashboard: http://localhost:5173/ (después de login)
