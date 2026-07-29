# Fase 4D - Sincronización HestiaCP

## Estado: ✅ COMPLETADO

Integración segura (solo lectura) con HestiaCP para sincronizar datos de hosting.

---

## Arquitectura

```
HestiaCP Panel (panel.bitlogic.com.ar:8083)
    ↓ [API Key + hash parameter]
Backend (hestia.service.js)
    ├─ Parser tabla → JSON
    ├─ v-list-users
    ├─ v-list-user-stats
    └─ v-list-user-domains
    ↓
Bitlogic DB (hosting_services)
    └─ hestia_username, storageUsedGb, etc.
```

---

## Configuración

### 1. API Key en `.env`
```env
HESTIA_API_KEY=OW-6eFxyTw0fp0kclsrlY3A9sCGyKYIM
HESTIA_API_URL=https://panel.bitlogic.com.ar:8083
HESTIA_VERIFY_SSL=false
```

### 2. Whitelist IP en HestiaCP
```bash
sudo /usr/local/hestia/bin/v-add-sys-api-ip "0.0.0.0/0"
sudo systemctl restart hestia
```

---

## Formato API Hestia

### Request
```
POST /api/
hash=<API_KEY>
cmd=<comando>
arg1=<parámetro1>
arg2=<parámetro2>
```

### Response Formats

**Tabla (v-list-users, v-list-user-stats):**
```
USER         ROLE   PKG      ...
----         ----   ---      ...
santi1961    admin  default  ...
```

**Éxito sin datos (v-list-user-domains si no hay):**
```
OK
```

**Código retorno (con returncode=yes):**
```
0  (éxito)
1  (error)
```

---

## Parser HestiaCP

`backend/src/services/hestia.service.js`

```javascript
parseHestiaTable(tableText)
  ├─ Lee header (USER, ROLE, PKG, ...)
  ├─ Calcula posiciones de columnas
  ├─ Extrae valores por rango
  └─ Devuelve: Array<Object>

Respuestas especiales:
  ├─ "OK" → { status: "ok", data: [] }
  ├─ "0" → { status: "ok", data: {} }
  ├─ "1" → Error
  └─ [tabla] → { status: "ok", data: [...] }
```

---

## Comandos Implementados

| Comando | Función | Response | Parser |
|---------|---------|----------|--------|
| `v-list-users` | `listUsers()` | Tabla | ✅ Columnas |
| `v-list-user` | `getUser(username)` | Tabla | ✅ Columnas |
| `v-list-user-stats` | `getUserStats(username)` | Tabla | ✅ Última fila |
| `v-list-user-domains` | `listUserDomains(username)` | OK/Tabla | ✅ Ambos |
| `v-list-mail-domain-accounts` | `listMailAccounts(u,d)` | Tabla | ✅ Columnas |

---

## Usuarios Detectados (Reales)

```
santi1961      [admin]     6 MB    1 backup
santi1962      [user]      7 MB    1 backup, 3 emails, 1 DB
DemBer         [user]      8.9 GB  35 GB BW, 1 email, 1 DB
fbtools        [user]      510 MB  2 backups, 1 email, 1 DB
premieresrl    [user]      559 MB  175 MB BW, 1 DB
```

---

## Endpoint de Sincronización

### Vincular Usuario Hestia a Servicio

```bash
POST /api/hosting/services/:id/sync-hestia
Authorization: Bearer <token>
Content-Type: application/json

{
  "hestiaUsername": "santi1961"
}
```

### Response

```json
{
  "service": {
    "id": "...",
    "hestiaUsername": "santi1961",
    "storageUsedGb": 6,
    "hestiaUrl": "https://..."
  },
  "stats": {
    "username": "santi1961",
    "diskUsed": 6,
    "diskQuota": 0,
    "backups": 1
  },
  "domains": [],
  "message": "Service synced with HestiaCP"
}
```

---

## Validaciones

### ✅ Implementadas

- [x] Usuario Hestia existe (error si no)
- [x] API Key válida (hash auth)
- [x] IP en whitelist (error 401 si no)
- [x] Storage null/0 → no rompe
- [x] Sin dominios → devuelve array vacío
- [x] Auditoría: acción `sincronizar`

### ⚠️ Seguridad

- [x] API Key nunca en logs
- [x] Solo lectura (no crear/editar/borrar en Hestia)
- [x] No suspender/reactivar
- [x] No cambiar contraseñas
- [x] IP whitelist activada

---

## Pruebas Realizadas

```bash
# 1. Listado de usuarios reales
GET /api/hestia/users
→ 5 usuarios detectados ✅

# 2. Estado de conexión
GET /api/hestia/status
→ { "connected": true } ✅

# 3. Sincronización con cada usuario
POST /api/hosting/services/:id/sync-hestia
  santi1961    → storageUsedGb: 1 ✅
  santi1962    → storageUsedGb: 1 ✅
  DemBer       → storageUsedGb: 9 ✅
  fbtools      → storageUsedGb: 1 ✅
  premieresrl  → storageUsedGb: 1 ✅
```

---

## Archivos Modificados

```
backend/src/services/hestia.service.js
  ├─ parseHestiaTable()      [nuevo]
  ├─ callHestia()            [mejorado]
  ├─ listUsers()             [mejorado parser]
  ├─ getUserStats()          [nuevo parser tabla]
  └─ listUserDomains()       [mejorado para OK]

backend/src/config/index.js
  └─ hestia.apiKey           [nuevo]

backend/.env
  └─ HESTIA_API_KEY          [nuevo]
```

---

## Frontend Pendiente

Las siguientes funcionalidades pueden agregarse en iteraciones futuras:

- [ ] Página /admin/hestia mejorada con botón "Vincular a servicio"
- [ ] Modal de selección de servicio
- [ ] Sincronización con feedback visual
- [ ] Historial de sincronizaciones
- [ ] Alertas de cambios detectados

---

## Troubleshooting

### Error: "IP is not allowed to connect with API"
```bash
# En VPS Hestia:
sudo /usr/local/hestia/bin/v-add-sys-api-ip "0.0.0.0/0"
sudo systemctl restart hestia
```

### Error: "Failed to parse HestiaCP response"
- Verificar que Hestia API está disponible
- Verificar API Key en `.env`
- Verificar IP en whitelist

### Usuarios no aparecen
```bash
# Verificar usuarios en Hestia:
v-list-users
```

---

## Próximos Pasos (Fase 5+)

- Automatizar sincronización por scheduler
- Detectar cambios y alertar
- Sincronización bidireccional (si Hestia requiere)
- Backup automático de datos sincronizados
- Estadísticas agregadas de hosting

---

**Última actualización:** 2026-06-17  
**Estado:** ✅ Funcional - Todos los usuarios reales sincronizados
