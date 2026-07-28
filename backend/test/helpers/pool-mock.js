import pool from "../../src/db/pool.js";

/**
 * Reemplaza pool.query por una cola de respuestas canned, en el orden en que
 * el código bajo prueba las va a pedir. Evita pegarle a Postgres real en
 * tests que solo necesitan simular filas específicas.
 *
 * Uso:
 *   const restore = mockPoolQueries(t, [{ rows: [...] }, { rows: [] }]);
 *   // ... ejercitar código que hace 2 pool.query() ...
 *   // restore() es automático al terminar el test si se usa t.mock.method,
 *   // pero acá lo hacemos manual para no atarnos a esa API.
 *
 * @param {import('node:test').TestContext} t
 * @param {Array<{rows: any[]} | Error>} responses
 */
export function mockPoolQueries(t, responses) {
  let call = 0;
  const original = pool.query;
  pool.query = async (..._args) => {
    const next = responses[call++];
    if (next === undefined) {
      throw new Error(`mockPoolQueries: se pidió una respuesta #${call} pero solo se programaron ${responses.length}`);
    }
    if (next instanceof Error) throw next;
    return next;
  };
  t.after(() => {
    pool.query = original;
  });
  return () => {
    pool.query = original;
  };
}

/**
 * Igual que mockPoolQueries, pero para el patrón de transacción manual
 * (`const client = await pool.connect(); await client.query(...); ...;
 * client.release()`, usado por services con BEGIN/COMMIT/ROLLBACK). Devuelve
 * un client falso cuyo .query() consume la misma cola de respuestas
 * canned — así un test puede verificar, por ejemplo, que tras un UPDATE con
 * rowCount 0 nunca se llega a ejecutar la query siguiente porque el service
 * cortó el flujo antes.
 *
 * @param {import('node:test').TestContext} t
 * @param {Array<{rows: any[], rowCount?: number} | Error>} responses
 */
export function mockPoolConnect(t, responses) {
  let call = 0;
  const queries = [];
  const original = pool.connect;
  pool.connect = async () => ({
    async query(sql) {
      queries.push(sql);
      const next = responses[call++];
      if (next === undefined) {
        throw new Error(`mockPoolConnect: se pidió una respuesta #${call} pero solo se programaron ${responses.length}`);
      }
      if (next instanceof Error) throw next;
      return next;
    },
    release() {},
  });
  t.after(() => {
    pool.connect = original;
  });
  return { restore: () => { pool.connect = original; }, queries };
}
