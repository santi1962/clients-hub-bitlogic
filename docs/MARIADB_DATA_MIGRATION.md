# Migración de datos reales PostgreSQL → MariaDB (Fase DB-4A)

**Estado: toolkit construido y validado de punta a punta contra un par de
bases sintéticas (Postgres + MariaDB descartables). La ejecución contra los
DATOS REALES todavía no se hizo** — este entorno de trabajo no tiene
credenciales del PostgreSQL real (ver "Limitación de esta sesión" abajo).
PostgreSQL sigue siendo el motor productivo; nada de esta fase lo cambia.

## Limitación de esta sesión (por qué se validó con datos sintéticos)

No existe `backend/.env` en este entorno y el usuario no recuerda la
contraseña del PostgreSQL real local (puerto 5432) — no se intentó
adivinarla ni forzarla, por la misma política que todas las fases
anteriores de esta migración. Se decidió junto al usuario (opción B de las
presentadas) construir y validar el toolkit completo contra:

- un **PostgreSQL descartable propio** (mismo binario `postgres.exe`
  instalado en esta máquina, datadir y puerto 15432 aparte), con el schema
  real aplicado vía `backend/src/db/migrate.js` (las 16 migraciones reales,
  no `schema.sql`) y poblado con los seeds existentes (`npm run seed`) más
  algunas filas sintéticas adicionales para ejercitar columnas que los
  seeds dejan vacías (JSON, booleanos, hashes, rutas de archivo — ver
  detalle en la Sección 1).
- una **MariaDB descartable** (XAMPP `mysqld.exe`, puerto 13309, mismo
  patrón que todas las fases anteriores — Docker Desktop no estaba
  corriendo en esta sesión, otra vez).

Todo lo que sigue en este documento (auditoría, backup, export, import,
validación, pruebas funcionales) se ejecutó realmente, con comandos reales,
contra ese par de bases — no es una simulación ni resultados inventados.
Lo único que falta para usar esto contra producción es correr los mismos
comandos con `--url`/`--pg-url`/`--mariadb-url` apuntando a las bases
reales, cuando haya credenciales.

## 1. Auditoría previa de datos

`node backend/scripts/mariadb-migration/audit-schema.mjs --url <postgres>`
compara `information_schema` real contra `backend/db/schema.sql` columna
por columna (nunca asume que coinciden). Resultado contra el Postgres
descartable (20/20 tablas, mismo schema que aplican las 16 migraciones
reales):

| Tabla | Filas | PK | FKs | Diferencias | Acción |
|---|---|---|---|---|---|
| users | 5 | 1 | 0 | — | Ninguna |
| clients | 8 | 1 | 0 | — | Ninguna |
| hosting_plans | 3 | 1 | 0 | — | Ninguna |
| email_templates | 2 | 1 | 0 | — | Ninguna |
| automation_settings | 8 | 1 | 0 | — | Ninguna (ver nota UUID/seed abajo) |
| company_settings | 1 | 1 | 0 | **`logo_url` solo existe en MariaDB** | Gap conocido (DB-3H) — se importa NULL, sin pérdida (Postgres nunca lo tuvo) |
| scheduler_logs | 1 | 1 | 0 | — | Ninguna |
| backups | 1 | 1 | 0 | — | Ninguna |
| refresh_tokens | 1 | 1 | 1 | — | Ninguna |
| password_reset_tokens | 1 | 1 | 1 | — | Ninguna |
| audit_logs | 1 | 1 | 1 | — | Ninguna |
| hosting_services | 12 | 1 | 2 | — | Ninguna |
| domains | 10 | 1 | 2 | — | Ninguna |
| payment_notices | 20 | 1 | 2 | — | Ninguna |
| support_tickets | 5 | 1 | 4 | — | Ninguna |
| payments | 12 | 1 | 3 | — | Ninguna |
| support_ticket_messages | 11 | 1 | 2 | **`attachment_url`/`attachment_type`/`attachment_name` solo en MariaDB, `message` NOT NULL en Postgres** | Gap conocido (DB-3F) — se importa NULL, sin pérdida |
| payment_reminder_logs | 1 | 1 | 1 | — | Ninguna |
| internal_tasks | 1 | 1 | 6 | — | Ninguna |
| email_logs | 1 | 1 | 4 | — | Ninguna |

**Confirmado con el código real de las migraciones (no supuesto):**
`backend/src/migrations/012_settings_schema.sql` no declara `logo_url`, y
`backend/src/migrations/005_support_schema.sql` no declara las 3 columnas
de adjunto ni permite `message` nulo — exactamente los dos gaps que DB-3F y
DB-3H ya habían documentado sobre `schema.sql` (MariaDB), ahora confirmados
también del lado real de Postgres. **Sin riesgo de pérdida de datos**: ambos
gaps son columnas que **Postgres nunca tuvo**, así que no hay ningún dato
real que se pudiera perder al pasar a MariaDB — al contrario, MariaDB ya
tiene esas columnas listas (nullable) para cuando la app las use.

**20 tablas en ambos lados, ninguna tabla exclusiva de un motor.**

## 2. Backup de la fuente

`node backend/scripts/mariadb-migration/backup-postgres.mjs --url <postgres> --out-dir <fuera del repo>`

Resultado real (contra el Postgres descartable):

| Campo | Valor |
|---|---|
| Formato | `pg_dump -Fc` (custom) |
| Tamaño | 0.08 MB (datos sintéticos — un backup real será mucho mayor) |
| SHA-256 | `ee6e706ce870631d92449e8968a5a4c81275f51541b4bbc8fe1eac59e238871a` |
| pg_dump | `pg_dump (PostgreSQL) 18.3` |
| Servidor origen | `PostgreSQL 18.3 on x86_64-windows` |
| Tablas en schema | 20 |
| Tablas con datos en el dump (`pg_restore -l`) | 20 |
| Permisos | `chmod 0600` (best-effort — NTFS no impone el mismo modelo, se aplica igual por si se mueve a un filesystem POSIX) |

`pg_restore -l` confirmó que el dump lista sus 20 tablas sin error — el
archivo no está corrupto ni truncado. No se modificó la base de origen. No
se borró ningún backup anterior (la herramienta nunca borra, solo agrega).

## 3. Herramientas creadas

```
backend/scripts/mariadb-migration/
├── README.md                 # guía de uso completa
├── table-order.js            # orden de dependencia FK de las 20 tablas + secuencias de negocio
├── check-collisions.mjs      # detección de colisiones case-insensitive (Sección 8)
├── audit-schema.mjs          # Sección 1
├── backup-postgres.mjs       # Sección 2
├── export-postgres.mjs       # Sección 5
├── import-mariadb.mjs        # Sección 6
├── validate-migration.mjs    # Sección 7
├── functional-check.mjs      # Sección 9
└── lib/
    ├── transform.js          # transformaciones puras por tipo de columna
    └── db-url.js             # redacción de URLs, rechazo de DATABASE_URL productiva
```

Ninguna herramienta lee `DATABASE_URL` — todas exigen `--url`/`--pg-url`/
`--mariadb-url` explícitos, y rechazan si la URL pasada es idéntica a
`DATABASE_URL` (`assertNotProductionDatabaseUrl`). Ninguna imprime una
contraseña (`describeUrl` solo muestra `protocolo://host:puerto/base`).

## 4. Formato intermedio

NDJSON por tabla (un objeto JSON por línea, ordenado por PK) + `manifest.json`.
**No CSV**: columnas JSONB/texto con saltos de línea, comas o comillas no
tienen representación CSV libre de ambigüedad sin escapeo manual — NDJSON
preserva tipos y caracteres especiales sin ningún escapeo custom, y sin
pasar por sed/regex en ningún punto del proceso.

El `manifest.json` real generado incluye: `formatVersion` (1), `generatedAt`,
`timezone` ("UTC"), `sourceEngine` ("postgresql"), `sourceVersion` (string
completo de `SELECT version()`), `sourceDescribed` (URL redactada),
`appCommit` (`git rev-parse HEAD`), `tableOrder` (las 20 tablas), y por
tabla: `rowCount`, `file`, `sha256`, `columns` (la lista real de columnas
de esa tabla en el Postgres de origen, no una lista fija hardcodeada — así
el importador nunca asume columnas que no existen).

## 5. Tablas y orden

Orden de dependencia FK (`table-order.js`, construido leyendo cada
`REFERENCES` real de `backend/src/migrations/*.sql`, no `schema.sql`):

```
users → clients → hosting_plans → email_templates → automation_settings →
company_settings → scheduler_logs → backups → refresh_tokens →
password_reset_tokens → audit_logs → hosting_services → domains →
payment_notices → support_tickets → payments → support_ticket_messages →
payment_reminder_logs → internal_tasks → email_logs
```

29 relaciones FK mapeadas explícitamente (ver `FK_GRAPH` en
`validate-migration.mjs`) — ninguna tabla se inserta antes que lo que
referencia.

## 6. Conteos de origen

(Sobre el Postgres sintético — ver conteos por tabla en la tabla de la
Sección 1, columna "Filas". Total: 105 filas en 20 tablas.)

## 7. Resultado de exportación

```
✓ Sin colisiones case-insensitive (users.email, clients.email, hosting_services.domain, domains.domain).
  ✓ users                           5 filas  sha256:ed292d949171…
  ✓ clients                         8 filas  sha256:05ec06120cd7…
  ... (20 tablas, 105 filas totales)
✓ Exportación completa — manifest.json con 20 tablas, formatVersion=1
No se modificó la base de origen.
```

## 8. Resultado de importación

```
Aplicando backend/db/schema.sql (apply-mariadb-schema.mjs)… ✓
✓ automation_settings: se vaciaron los 8 defaults sembrados por schema.sql
✓ Destino vacío confirmado (las 20 tablas en 0 filas)
  ✓ users … 5 filas importadas
  ... (20 tablas, 105 filas importadas)
Reposicionando secuencias de negocio…
  ✓ payment_notice_number_seq reposicionada a 20 (próximo NEXTVAL será 21)
  ✓ support_ticket_number_seq reposicionada a 5 (próximo NEXTVAL será 6)
✓ Importación completa.
```

**Hallazgo real durante esta fase**: `automation_settings` es la única
tabla con datos propios de `schema.sql` (el `INSERT IGNORE` de 8 defaults
que corre al aplicar el schema) — importar los valores históricos reales
sobre esos defaults ya sembrados violaría el `UNIQUE(key)`. `import-mariadb.mjs`
lo resuelve vaciando esa tabla específica ANTES del chequeo de "destino
vacío" (no son datos de un usuario, son placeholders de configuración que
la migración real reemplaza).

## 9. Resultado completo de validación

`validate-migration.mjs` corrido contra el par sintético — **17/17
categorías, 0 diferencias, exit code 0**:

1. ✓ Conteos exactos (20/20 tablas)
2. ✓ PKs exactas (0 solo-en-Postgres, 0 solo-en-MariaDB)
3. ✓ FKs huérfanas: 0 en las 29 relaciones
4. ✓ UUIDs válidos (100% de las PKs, excepto `email_templates` que usa código)
5. ✓ Hashes/tokens exactos byte a byte (`refresh_tokens`, `password_reset_tokens`)
6. ✓ JSON semánticamente equivalente (`audit_logs`, `automation_settings`, `scheduler_logs`)
7. ✓ Booleanos equivalentes (`domains.auto_renew`, `support_ticket_messages.is_internal`, `automation_settings.enabled`)
8. ✓ DATE exacta (`domains`, `payment_notices`, `payment_reminder_logs`)
9. ✓ TIMESTAMP equivalente en UTC (±1s, las 20 tablas)
10. ✓ DECIMAL exacto como string normalizado
11. ✓ Texto UTF-8 exacto (tildes/ñ/emoji/saltos de línea — probado con "Café del Valle ☕", "año 2026, ñoño 🎉")
12. ✓ Rutas de archivo preservadas (`backups.file_path`)
13. ✓ Sin colisiones UNIQUE inesperadas post-import
14. ✓ Sin colisiones case-insensitive pendientes
15. ✓ Sumas financieras exactas (ver Sección 12)
16. ✓ Conteos agrupados por estado/rol coinciden (roles, estados de clientes/servicios/dominios/avisos/pagos, prioridades de tickets)
17. ✓ Secuencias reposicionadas por encima del máximo histórico

## 10. Colisiones detectadas

**Ninguna** en la corrida real (ni en el pre-flight del export ni en la
revalidación post-import). El mecanismo de detección se probó igual, dos
veces:

- **Con fixtures unitarios** (`test/mariadb-migration-transform-domain.test.js`):
  `findCaseInsensitiveCollisionsInRows` detecta correctamente un par
  `"Cliente@Test.com"` / `"cliente@test.com"` y lo distingue de valores
  case-únicos o `null`.
- **Documentado, no ejecutado con datos reales**: cuando se corra contra el
  Postgres real, `export-postgres.mjs` aborta automáticamente si aparece
  alguna — no se resuelve sola, requiere una decisión humana sobre qué fila
  prevalece.

## 11. Sumas financieras comparadas

| Columna | PostgreSQL | MariaDB | Coincide |
|---|---|---|---|
| `payments.amount` | 247.00 | 247.00 | ✓ |
| `payment_notices.amount` | 341.00 | 341.00 | ✓ |
| `hosting_services.monthly_price` | 173.00 | 173.00 | ✓ |
| `domains.annual_cost` | 4900.00 | 4900.00 | ✓ |
| `domains.customer_price` | 7950.00 | 7950.00 | ✓ |

## 12. Fechas/JSON/UUID/FK

Todos verificados sin diferencias — ver detalle de checks 3–9 de la
Sección 9. Ejemplo real de una fila con JSON+UTF-8 exportada:

```json
{"id":"...", "entity_name":"Café del Valle ☕", "old_values":"{\"status\":\"active\"}", "new_values":"{\"nota\":\"año 2026, ñoño\",\"status\":\"inactive\"}", "created_at":"2026-07-30T12:23:56.116Z"}
```

## 13. Pruebas funcionales con datos migrados

`functional-check.mjs` arranca `src/server.js` (proceso real, no `app.js`
en memoria) con `SCHEDULER_ENABLED=false` e integraciones externas
deshabilitadas, contra la MariaDB migrada.

**Modo `readonly`** (contra la copia validada, sin escribir nada): **23/23
chequeos OK** — health/live, health/ready, Socket.IO, login admin real
migrado, dashboard, dashboard/analytics, clientes, planes, servicios,
dominios, avisos, pagos, cobranza, tickets, tareas, settings, templates,
automation settings, scheduler (jobs/logs), auditoría, backups, búsqueda
global, y confirmación de un usuario `cliente` real migrado.

**Modo `write`** (contra una copia adicional descartable, creada solo para
esto y borrada después): **28/28 chequeos OK** — todo lo anterior más
crear/editar/eliminar un cliente de prueba y una tarea de prueba, ambos
etiquetados `[FUNCTIONAL-CHECK]`. La copia de escritura se borró
(`DROP DATABASE`) inmediatamente después. La copia de solo lectura y el
par sintético original quedaron intactos.

No se envió ningún email, pago o notificación real (SMTP/MercadoPago/
Telegram/WhatsApp sin configurar en el proceso hijo).

## 14. Tests agregados

- `test/mariadb-migration-transform-domain.test.js` (23 tests, sin base de
  datos): las 6 transformaciones (UUID, NUMERIC, timestamp, date, JSON,
  boolean, texto), checksum, orden de tablas + secuencias, y detección de
  colisiones — todo con fixtures sintéticos armados a mano, ningún dato real.
- `test/mariadb-migration-mariadb.test.js` (integración real, MariaDB
  descartable, `MARIADB_TEST_URL`): manifest con `formatVersion` no
  soportado rechazado; import válido; reimport sin `--force` rechazado;
  reimport con `--force` pero duplicado real rechazado (sin `INSERT IGNORE`,
  confirmado el mensaje `Duplicate` real de MariaDB); checksum corrupto
  rechazado (0 filas escritas); rollback de lote real (una fila con `role`
  fuera del CHECK constraint junto a una fila válida en el mismo lote — el
  `ROLLBACK` deja la tabla en 0 filas, ni la fila válida sobrevive).

## 15. Archivos modificados

Nuevos: los 11 archivos de `backend/scripts/mariadb-migration/` (listados
en la Sección 3), `test/mariadb-migration-transform-domain.test.js`,
`test/mariadb-migration-mariadb.test.js`, este documento. Modificado:
`.gitignore` (directorios de exportación/backup, `*.dump`).

## 16. Datos reales modificados

- **PostgreSQL: ninguno.** Ninguna herramienta de este toolkit ejecuta
  `UPDATE`/`DELETE`/`INSERT` contra Postgres — `audit-schema.mjs`,
  `backup-postgres.mjs` y `export-postgres.mjs` son 100% de solo lectura
  (confirmado leyendo su propio código: solo `SELECT`/`pg_dump`).
- **MariaDB: solo copias locales descartables**, todas en un servidor
  `mysqld.exe` de XAMPP con datadir y puerto propios (13309), ya destruidas
  al cerrar esta fase (la copia de escritura se borró explícitamente
  durante la Sección 13; el resto se limpia al terminar la sesión de
  trabajo). Nada persistente, nada en el VPS.

## 17. Cómo repetir esto contra los datos reales (antes del corte final)

1. Conseguir `DATABASE_URL` del PostgreSQL real (pendiente — ver
   limitación de esta sesión arriba).
2. `node audit-schema.mjs --url <postgres real>` — confirmar que la matriz
   de diferencias sigue siendo solo los 2 gaps conocidos (o menos). Si
   aparece cualquier "RIESGO DE PÉRDIDA", frenar y resolver antes de seguir.
3. `node backup-postgres.mjs --url <postgres real> --out-dir <fuera del repo>` —
   guardar el backup y su checksum en un lugar seguro, fuera de Git.
4. `node export-postgres.mjs --url <postgres real> --out-dir <fuera del repo>` —
   si aborta por colisiones case-insensitive, decidir manualmente qué fila
   prevalece antes de continuar (no hay resolución automática).
5. Levantar una MariaDB 11.4 real y descartable (Docker si está disponible
   esta vez, o XAMPP como en esta sesión).
6. `node import-mariadb.mjs --url <mariadb descartable> --export-dir <export> --dry-run` primero, después sin `--dry-run`.
7. `node validate-migration.mjs --pg-url <postgres real> --mariadb-url <mariadb descartable>` —
   debe terminar con exit code 0 y 0 `failures` antes de seguir.
8. `node functional-check.mjs --mode readonly` contra la copia validada;
   `--mode write` SOLO contra una copia adicional descartable, borrada después.
9. Recién ahí — con el visto bueno del usuario — se puede planear el corte
   real (fase futura, fuera de este alcance): apagar escrituras en
   Postgres, correr los mismos pasos 3–7 una última vez contra los datos
   más frescos, y recién ahí cambiar `DATABASE_URL` en el VPS.

## 18. Protección de secretos

Ninguna URL se imprime con contraseña. Ningún archivo de exportación/backup
se trackea en Git (`.gitignore` actualizado con 5 patrones nuevos). Los
archivos se crean con `chmod 0600` (best-effort en Windows/NTFS). El
`--defaults-extra-file` ya establecido para backups de la app (DB-3K) no
aplica acá directamente (`pg_dump`/`pg_restore` toman la URL completa, que
ya evita pasar la contraseña como argumento separado visible en `ps`).

## 19. Limitaciones

- No se ejecutó ni una sola vez contra el PostgreSQL real de este entorno
  (sin credenciales, ver arriba) — toda la validación es contra un par
  sintético equivalente en estructura pero no en volumen ni en la variedad
  real de datos de producción.
- El volumen de datos reales de producción es desconocido desde acá — el
  rendimiento del importador (batches de 500 filas, una transacción por
  tabla) no se probó contra miles/decenas de miles de filas.
- `mysqldump`/`pg_dump` de terceros (para clonar una base ya migrada, ej.
  para las pruebas funcionales) tropiezan con un bug conocido de MariaDB al
  volcar `SEQUENCE` (`ERROR 1959`) — se resolvió reimportando desde el
  mismo `export-postgres.mjs` en vez de clonar con `mysqldump`, documentado
  para no repetir el mismo intento fallido en el futuro.
