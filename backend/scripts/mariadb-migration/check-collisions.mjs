// check-collisions.mjs — Fase DB-4A, Sección 8: colisiones case-insensitive.
//
// MariaDB usa collation case-insensitive (utf8mb4_unicode_520_ci) en
// users.email, clients.email, hosting_services.domain y domains.domain —
// dos valores que Postgres trata como distintos ("Cliente@x.com" vs
// "cliente@x.com") COLISIONAN como UNIQUE bajo MariaDB. Esto NO se resuelve
// automáticamente acá — se detecta y se lista para que decida un humano.
//
// Exporta `findCaseInsensitiveCollisions(client)`, usada tanto por
// export-postgres.mjs (pre-flight, aborta si hay colisiones) como por sus
// propios tests con fixtures.
const COLUMNS_TO_CHECK = [
  { table: "users", column: "email" },
  { table: "clients", column: "email" },
  { table: "hosting_services", column: "domain" },
  { table: "domains", column: "domain" },
];

/**
 * @param {import('pg').Client} client
 * @returns {Promise<Array<{table: string, column: string, lowerValue: string, ids: string[], values: string[]}>>}
 */
export async function findCaseInsensitiveCollisions(client) {
  const collisions = [];

  for (const { table, column } of COLUMNS_TO_CHECK) {
    const { rows } = await client.query(`
      SELECT LOWER(${column}) AS lower_value, array_agg(id::text ORDER BY id) AS ids, array_agg(${column} ORDER BY id) AS values
      FROM ${table}
      WHERE ${column} IS NOT NULL
      GROUP BY LOWER(${column})
      HAVING COUNT(*) > 1
    `);
    for (const row of rows) {
      collisions.push({
        table,
        column,
        lowerValue: row.lower_value,
        ids: row.ids,
        values: row.values,
      });
    }
  }

  return collisions;
}

/** Detecta colisiones sobre un array de filas ya en memoria (usado por los tests, sin tocar ninguna base). */
export function findCaseInsensitiveCollisionsInRows(rows, column) {
  const byLower = new Map();
  for (const row of rows) {
    const value = row[column];
    if (value === null || value === undefined) continue;
    const key = String(value).toLowerCase();
    if (!byLower.has(key)) byLower.set(key, []);
    byLower.get(key).push(row);
  }
  return [...byLower.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([lowerValue, group]) => ({
      lowerValue,
      ids: group.map((r) => r.id),
      values: group.map((r) => r[column]),
    }));
}

/** Formatea colisiones para log/reporte SIN exponer más que lo necesario (ids + los valores en conflicto, nada de otras columnas). */
export function formatCollisionsReport(collisions) {
  if (!collisions.length) return "Sin colisiones case-insensitive detectadas.";
  const lines = ["Colisiones case-insensitive detectadas (MariaDB las trataría como UNIQUE duplicado):"];
  for (const c of collisions) {
    lines.push(`  ${c.table}.${c.column} = "${c.lowerValue}" (case-insensitive) — ${c.ids.length} filas: ${c.ids.join(", ")} — valores originales: ${c.values.map((v) => `"${v}"`).join(", ")}`);
  }
  return lines.join("\n");
}
