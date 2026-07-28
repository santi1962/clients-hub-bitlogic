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
