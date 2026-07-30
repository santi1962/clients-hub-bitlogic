# Migraciones históricas de PostgreSQL (NO ejecutables)

Estos 16 archivos SQL son las migraciones que usó PostgreSQL como motor de
base de datos del Bitlogic Client Hub hasta la Fase DB-5A. Se conservan acá
únicamente como **referencia histórica** — para entender de dónde salió cada
tabla/columna/constraint del schema actual — y **no forman parte de ningún
flujo de instalación ni de deploy**.

## Por qué ya no se ejecutan

- MariaDB 11.4 es el único motor soportado por el backend desde la Fase DB-5A.
- `backend/db/schema.sql` es la única fuente de verdad del schema — se aplica
  con `npm run db:schema:mariadb` para levantar una instalación desde cero.
- Ningún script del backend (`npm run migrate`, `npm start`, tests, CI) lee
  ni ejecuta los archivos de esta carpeta.
- El proyecto no conserva datos productivos de PostgreSQL que migrar — la
  base de producción se crea nueva, directamente en MariaDB.

## Qué NO hacer con esta carpeta

- No ejecutar estos archivos contra ninguna base de datos (asumen sintaxis
  PostgreSQL — `SERIAL`, `gen_random_uuid()`, `ON CONFLICT`, etc. — que
  MariaDB no soporta).
- No agregar migraciones nuevas acá: cualquier cambio de schema futuro se
  hace directamente sobre `backend/db/schema.sql`.
- No borrarlos: quedan como historia de cómo evolucionó cada tabla.
