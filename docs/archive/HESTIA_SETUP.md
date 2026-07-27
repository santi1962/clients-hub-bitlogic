# Configuración de HestiaCP Integration

## Análisis de la Estructura del Proyecto

### 1. Dónde Está Configurado

**Archivo de Configuración Principal:**
- `backend/src/config/index.js` — Carga TODAS las variables de entorno

**Archivo de Variables de Entorno (IMPORTANTE):**
- `backend/.env` — Archivo REAL que se ejecuta en desarrollo
  - ✅ DEBE contener HESTIA_API_URL, HESTIA_USERNAME, HESTIA_PASSWORD, HESTIA_VERIFY_SSL
  
**Archivo de Referencia (NO se ejecuta):**
- `backend/.env.example` — Plantilla de ejemplo (solo para copiar)

### 2. Cómo Se Carga Dotenv

```
backend/src/config/index.js (línea 1)
  └─> import "dotenv/config"  ← Carga automáticamente backend/.env
```

**Secuencia de carga:**
1. `dotenv/config` carga `backend/.env`
2. `process.env.HESTIA_API_URL` queda disponible
3. `config/index.js` lee estas variables
4. `hestia.service.js` importa config y usa los valores

### 3. Variablesblea de Entorno Requeridas

**En backend/.env (el archivo REAL):**

```env
# HestiaCP — Integración con panel de hosting (solo lectura)
HESTIA_API_URL=https://srv01.bitlogic.com.ar:8083
HESTIA_USERNAME=admin
HESTIA_PASSWORD=tu_password_hestia
HESTIA_VERIFY_SSL=true
```

**Explicación:**
- `HESTIA_API_URL` — URL del panel HestiaCP (https://dominio:puerto)
- `HESTIA_USERNAME` — Usuario del panel (generalmente "admin")
- `HESTIA_PASSWORD` — Contraseña para acceder al panel
- `HESTIA_VERIFY_SSL` — true/false para validar certificados SSL

### 4. Archivos Que Leen Variables de Entorno

```
backend/src/config/index.js (línea 1-42)
  ├─> Carga: "dotenv/config"
  ├─> Lee: process.env.HESTIA_API_URL
  ├─> Lee: process.env.HESTIA_USERNAME
  ├─> Lee: process.env.HESTIA_PASSWORD
  └─> Lee: process.env.HESTIA_VERIFY_SSL
       └─> Exporta como config.hestia = {...}

backend/src/services/hestia.service.js (línea 8)
  ├─> Importa: config from "../config/index.js"
  └─> Usa: config.hestia.url
           config.hestia.username
           config.hestia.password
           config.hestia.verifySsl

backend/src/controllers/hestia.controller.js (línea 3)
  └─> Usa: hestiaService.testConnection()
           └─> Que lee del config
```

### 5. Validaciones Implementadas

**En config/index.js (línea 36-41):**
```javascript
hestia: {
  url: process.env.HESTIA_API_URL,
  username: process.env.HESTIA_USERNAME,
  password: process.env.HESTIA_PASSWORD,
  verifySsl: process.env.HESTIA_VERIFY_SSL !== "false",  // ← Default true
}
```

**En hestia.service.js (línea 15-17):**
```javascript
if (!config.hestia.url || !config.hestia.username || !config.hestia.password) {
  throw new Error("HestiaCP not configured");
}
```

## Cómo Configurar Para Tu Servidor

### Paso 1: Editar backend/.env

```bash
# Abre backend/.env y reemplaza:
HESTIA_API_URL=https://tu-servidor.com.ar:8083
HESTIA_USERNAME=admin
HESTIA_PASSWORD=tu_password_real
HESTIA_VERIFY_SSL=true
```

### Paso 2: Determinar Tu URL de HestiaCP

**Formato esperado:**
```
https://[tu-dominio-o-ip]:[puerto]
```

**Ejemplos válidos:**
- `https://srv01.bitlogic.com.ar:8083`
- `https://192.168.1.100:8083`
- `https://hosting.miempresa.com.ar:8083`

**Nota:** El puerto 8083 es el estándar de HestiaCP. Si usas otro puerto, ajusta.

### Paso 3: Obtener Credenciales

Las credenciales son las MISMAS que usas para loguear en el panel:
- Usuario: generalmente "admin" (la cuenta principal del servidor)
- Contraseña: la que ingresaste al instalar HestiaCP

### Paso 4: Validar SSL (IMPORTANTE)

Si tu servidor usa certificado SSL auto-firmado:
```
HESTIA_VERIFY_SSL=false
```

Si usa certificado válido (recomendado):
```
HESTIA_VERIFY_SSL=true
```

## Cómo Probar la Conexión

### Opción 1: Desde la Interfaz Web

1. Inicia el backend: `cd backend && npm start`
2. Inicia el frontend: `npm run dev` (en la raíz)
3. Abre: `http://localhost:5173/admin/configuracion`
4. Ve a: Hosting → "Probar conexión HestiaCP"
5. Deberías ver: "Conectado a HestiaCP: https://..."

### Opción 2: Usando cURL

```bash
# Test directo al endpoint
curl -H "Authorization: Bearer $YOUR_JWT_TOKEN" \
  http://localhost:3001/api/hestia/status

# Respuesta esperada:
# {
#   "connected": true,
#   "server": "https://srv01.bitlogic.com.ar:8083",
#   "message": "Connected to HestiaCP"
# }
```

### Opción 3: Desde la Página /admin/hestia

1. Abre: `http://localhost:5173/admin/hestia`
2. Deberías ver:
   - Estado: Conectado (verde) o No conectado (rojo)
   - Lista de usuarios de tu servidor Hestia
   - Dominios, uso de disco, etc.

## Posibles Errores y Soluciones

### Error: "HestiaCP not configured"

**Causa:** Las variables de entorno no están en backend/.env

**Solución:**
```bash
# Verifica que backend/.env contiene:
grep HESTIA backend/.env

# Si no aparecen, agrega:
cat >> backend/.env <<'EOF'
HESTIA_API_URL=https://tu-servidor:8083
HESTIA_USERNAME=admin
HESTIA_PASSWORD=tu_password
HESTIA_VERIFY_SSL=true
EOF
```

### Error: "Connection refused"

**Causa:** El servidor Hestia no está accesible en esa URL

**Solución:**
1. Verifica URL: `HESTIA_API_URL=https://srv01.bitlogic.com.ar:8083`
2. Verifica puerto: Hestia usa 8083 por defecto
3. Verifica firewall: ¿Permite conexiones al puerto 8083?
4. Verifica red: ¿Puedes hacer ping al servidor?

### Error: "ENOTFOUND srv01.bitlogic.com.ar"

**Causa:** El nombre de dominio no se resuelve

**Solución:**
1. Usa IP en lugar de dominio: `HESTIA_API_URL=https://200.45.12.34:8083`
2. O verifica DNS: `nslookup srv01.bitlogic.com.ar`

### Error: "401 Unauthorized"

**Causa:** Usuario o contraseña incorrectos

**Solución:**
1. Verifica credenciales en backend/.env
2. Prueba loguear manualmente en el panel Hestia
3. Verifica mayúsculas/minúsculas en usuario y password

### Error: "certificate verify failed" (HESTIA_VERIFY_SSL=true)

**Causa:** Certificado SSL no válido o auto-firmado

**Solución:**
```
# Cambia a:
HESTIA_VERIFY_SSL=false
```

**Nota:** Solo para desarrollo. En producción usa certificados válidos.

## Estructura del Flujo de Carga

```
npm start (en backend/)
  ↓
backend/src/server.js
  ↓
backend/src/app.js
  ↓
import routes from "./routes/hestia.routes.js"
  ↓
hestia.routes.js importa: hestiaService
  ↓
hestiaService importa: config
  ↓
config/index.js (línea 1):
  import "dotenv/config"
    ↓
    [CARGA backend/.env aquí]
    ↓
    Toma HESTIA_API_URL = "https://..."
    Toma HESTIA_USERNAME = "admin"
    Toma HESTIA_PASSWORD = "..."
    Toma HESTIA_VERIFY_SSL = "true"
    ↓
    Exporta como config.hestia = {...}
    ↓
hestiaService usa: config.hestia.url, etc
  ↓
GET /api/hestia/status funciona correctamente
```

## Checklist de Configuración

- [ ] Abrí `backend/.env`
- [ ] Agregué `HESTIA_API_URL=https://tu-servidor:8083`
- [ ] Agregué `HESTIA_USERNAME=admin`
- [ ] Agregué `HESTIA_PASSWORD=tu_password`
- [ ] Agregué `HESTIA_VERIFY_SSL=true` (o false si es auto-signed)
- [ ] Guardé el archivo
- [ ] Reinicié el backend: `cd backend && npm start`
- [ ] Probé desde `/admin/configuracion` o `/admin/hestia`
- [ ] Veo "Conectado a HestiaCP" en verde ✓

## Variables en Backend/.env (ACTUALIZADO)

```
# HestiaCP — Integración con panel de hosting (solo lectura)
HESTIA_API_URL=https://srv01.bitlogic.com.ar:8083
HESTIA_USERNAME=admin
HESTIA_PASSWORD=tu_password_hestia
HESTIA_VERIFY_SSL=true
```

Está ahora en `backend/.env` (el archivo real de ejecución).

## Información de Debugging

Si necesitas verificar qué variables está leyendo el backend:

```bash
# En backend/src/config/index.js, agrega temporalmente:
console.log("HestiaCP Config:", config.hestia);

# Luego reinicia y observa la consola
npm start
```

Deberías ver algo como:
```
HestiaCP Config: {
  url: 'https://srv01.bitlogic.com.ar:8083',
  username: 'admin',
  password: '...',
  verifySsl: true
}
```
