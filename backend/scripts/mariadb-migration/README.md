# Migrador de datos reales PostgreSQL → MariaDB (Fase DB-4A)

Herramientas para exportar los datos reales de PostgreSQL, transformarlos
sin pérdida, importarlos a una MariaDB limpia, y validar automáticamente
que ambas bases contienen información equivalente — **sin tocar todavía el
motor productivo ni el VPS**. Ver `docs/MARIADB_DATA_MIGRATION.md` para el
procedimiento completo, paso a paso, con el resultado de la validación
contra un par de bases sintéticas.

## Reglas de seguridad (por qué estos scripts se comportan así)

- **Ninguna herramienta lee `DATABASE_URL`** (la variable "productiva" del
  backend) — todas exigen `--url`/`--pg-url`/`--mariadb-url` explícitos.
  `assertNotProductionDatabaseUrl()` además rechaza si por accidente se pasa
  una URL idéntica a `DATABASE_URL`.
- **Nunca se imprime una contraseña** — `describeUrl()` solo muestra
  `protocolo://host:puerto/base`.
- **El importador rechaza un destino con datos** salvo `--force` explícito,
  y **nunca usa `INSERT IGNORE`** para ocultar un duplicado real (un
  duplicado siempre aborta, incluso con `--force`).
- **Colisiones case-insensitive** (`users.email`, `clients.email`,
  `hosting_services.domain`, `domains.domain`) se detectan ANTES de
  exportar y frenan el proceso — no se resuelven solas.
- Todo archivo de exportación (`*.ndjson`, `manifest.json`, `*.dump`) se
  crea con permisos `0600` y vive fuera de Git (`.gitignore` raíz del repo).

## Orden de uso

```bash
cd backend

# 1. Auditoría — compara información_schema real vs backend/db/schema.sql,
#    solo lectura, no modifica nada.
node scripts/mariadb-migration/audit-schema.mjs --url postgresql://user:pass@host:port/db

# 2. Backup de la fuente — pg_dump -Fc + checksum SHA-256 + verificación
#    con pg_restore -l. Guardarlo FUERA del repo.
node scripts/mariadb-migration/backup-postgres.mjs --url postgresql://... --out-dir /ruta/fuera/del/repo/backups

# 3. Exportación — NDJSON por tabla + manifest.json. Aborta si hay
#    colisiones case-insensitive sin resolver (a menos que pases
#    --allow-collisions, ya evaluado a mano).
node scripts/mariadb-migration/export-postgres.mjs --url postgresql://... --out-dir /ruta/fuera/del/repo/export-2026-07-30

# 4. Importación — aplica backend/db/schema.sql (runner existente),
#    rechaza un destino con datos salvo --force, importa en el orden de
#    table-order.js, reposiciona las secuencias de negocio al final.
#    --dry-run valida manifest + checksums sin escribir nada.
node scripts/mariadb-migration/import-mariadb.mjs --url mysql://... --export-dir /ruta/.../export-2026-07-30 --dry-run
node scripts/mariadb-migration/import-mariadb.mjs --url mysql://... --export-dir /ruta/.../export-2026-07-30

# 5. Validación — compara PostgreSQL vs MariaDB en 17 dimensiones (conteos,
#    PKs, FKs huérfanas, UUID, hashes, JSON, booleanos, fechas, sumas
#    financieras, UTF-8, paths, UNIQUE, colisiones, conteos agrupados,
#    secuencias). Exit code != 0 ante cualquier diferencia.
node scripts/mariadb-migration/validate-migration.mjs --pg-url postgresql://... --mariadb-url mysql://...

# 6. Pruebas funcionales — arranca el backend completo apuntando a la
#    MariaDB migrada (integraciones externas deshabilitadas). Modo
#    "readonly" contra la copia validada; modo "write" SOLO contra una
#    copia adicional descartable (se borra después).
node scripts/mariadb-migration/functional-check.mjs --url mysql://.../copia_validada --mode readonly --admin-email admin@... --admin-password '...'
node scripts/mariadb-migration/functional-check.mjs --url mysql://.../copia_descartable --mode write --admin-email admin@... --admin-password '...'
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `audit-schema.mjs` | Sección 1 — compara Postgres real (`information_schema`) vs `schema.sql`, columna por columna. Frena si hay riesgo de pérdida de datos. |
| `backup-postgres.mjs` | Sección 2 — `pg_dump -Fc` + checksum + verificación con `pg_restore -l`. |
| `export-postgres.mjs` | Sección 5 — NDJSON + `manifest.json`. Corre el chequeo de colisiones (Sección 8) como pre-flight. |
| `import-mariadb.mjs` | Sección 6 — aplica schema, importa en orden FK, transacción por tabla, reposiciona secuencias. |
| `validate-migration.mjs` | Sección 7 — 17 categorías de comparación, reporte JSON + legible, exit code != 0 ante diferencias. |
| `check-collisions.mjs` | Sección 8 — detección de colisiones case-insensitive, reusado por el export y por sus propios tests. |
| `table-order.js` | Orden de dependencia FK de las 20 tablas + secuencias de negocio (`payment_notice_number_seq`, `support_ticket_number_seq`). |
| `functional-check.mjs` | Sección 9 — smoke test funcional del backend completo contra una MariaDB ya migrada. |
| `lib/transform.js` | Transformaciones puras por tipo de columna (UUID, NUMERIC, fechas, JSON, booleanos, texto) + checksum. |
| `lib/db-url.js` | Redacción de URLs para logs, comparación origen≠destino, rechazo de `DATABASE_URL` productiva. |

## Formato intermedio

Un directorio de exportación contiene:

```
export-2026-07-30T.../
├── manifest.json          # metadatos: fecha, motor/versión origen, orden de tablas,
│                          # conteos, checksums por tabla, formatVersion, timezone, commit
├── users.ndjson           # un objeto JSON por línea, ordenado por PK
├── clients.ndjson
└── ... (una por cada una de las 20 tablas)
```

NDJSON (no CSV) porque columnas JSONB/texto con saltos de línea, comas o
comillas no tienen una representación CSV libre de ambigüedad sin escapeo
manual — un objeto JSON por línea preserva tipos y caracteres especiales sin
ningún escapeo custom, y sin pasar por sed/regex en ningún punto.

## Limitaciones conocidas

- `automation_settings` es la única tabla con datos propios de `schema.sql`
  (el `INSERT IGNORE` de 8 defaults que corre al aplicar el schema) —
  `import-mariadb.mjs` la vacía automáticamente antes de importar los
  valores históricos reales, documentado explícitamente en su código.
- El chequeo "destino vacío" cuenta filas en las 20 tablas — si el destino
  tiene cualquier dato de una corrida anterior, hace falta `--force` (y aun
  así un duplicado real sigue abortando, nunca se ignora en silencio).
- `functional-check.mjs --mode write` NUNCA debe apuntar a la copia migrada
  que se va a usar para decidir el corte — solo a una copia adicional
  descartable, creada solo para esa prueba.
