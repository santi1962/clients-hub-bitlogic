import { createServer } from "node:http";

/**
 * Levanta un app de Express en un puerto efímero (0 = el SO elige uno libre)
 * para poder pegarle con fetch nativo en los tests, sin depender de un
 * puerto fijo ni de que el backend real esté corriendo.
 */
export async function startEphemeralServer(app) {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
