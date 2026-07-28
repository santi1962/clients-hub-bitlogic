import { signAccessToken } from "../../src/utils/jwt.js";

/**
 * Genera un access token real (firmado con el secret de desarrollo que ya
 * usa el proceso de test — nunca un secreto de producción) para probar
 * rutas autenticadas sin pasar por /api/auth/login.
 */
export function buildAccessToken(payload) {
  return signAccessToken({ sub: payload.sub, role: payload.role, clientId: payload.clientId ?? null });
}
