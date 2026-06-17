/**
 * Sistema de autenticación — integración real con backend JWT.
 *
 * Flujo de inicialización:
 *  1. AuthProvider monta → llama POST /api/auth/refresh (cookie httpOnly).
 *  2. Si ya hay accessToken en memoria (post-login en misma pestaña) → salta el refresh.
 *  3. Con el accessToken listo → GET /api/auth/me → hidrata AuthUser.
 *  4. Si cualquier paso falla → user = null → AuthGuard redirige a /login.
 *
 * Refresh automático:
 *  El interceptor en request() (api-client.ts) captura 401 y renueva el token
 *  transparentemente. Si el refresh falla, redirige a /login.
 *
 * Modo demo (solo en desarrollo):
 *  setRole() cambia el rol y los permisos localmente sin afectar el JWT.
 *  En producción (import.meta.env.DEV === false) esta función no aparece en la UI.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, setAccessToken, getAccessToken } from "./api-client";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
export type Role = "super_admin" | "admin" | "soporte" | "finanzas" | "cliente";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  soporte: "Soporte",
  finanzas: "Finanzas",
  cliente: "Cliente",
};

export type Permission =
  | "dashboard"
  | "operaciones"
  | "cobranza"
  | "clientes"
  | "clientes:write"
  | "servicios"
  | "servicios:write"
  | "dominios"
  | "planes"
  | "soporte"
  | "tareas"
  | "automatizaciones"
  | "pagos"
  | "avisos"
  | "usuarios"
  | "arquitectura"
  | "workflows"
  | "notificaciones"
  | "configuracion"
  | "plantillas"
  | "bienvenida"
  | "portal";

// ─────────────────────────────────────────────────────────────
// Matriz de permisos por rol (fuente de verdad frontend).
// Cuando el backend envíe permisos en el JWT, mapear desde allí.
// ─────────────────────────────────────────────────────────────
export const PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "dashboard",
    "operaciones",
    "cobranza",
    "bienvenida",
    "notificaciones",
    "configuracion",
    "plantillas",
    "clientes",
    "clientes:write",
    "servicios",
    "servicios:write",
    "dominios",
    "planes",
    "soporte",
    "tareas",
    "automatizaciones",
    "pagos",
    "avisos",
    "usuarios",
    "arquitectura",
    "workflows",
    "portal",
  ],
  admin: [
    "dashboard",
    "operaciones",
    "bienvenida",
    "notificaciones",
    "plantillas",
    "clientes",
    "clientes:write",
    "servicios",
    "servicios:write",
    "dominios",
    "soporte",
    "tareas",
    "pagos",
    "avisos",
    "workflows",
  ],
  soporte: [
    "dashboard",
    "operaciones",
    "soporte",
    "tareas",
    "bienvenida",
    "notificaciones",
    "clientes",
    "servicios",
  ],
  finanzas: [
    "dashboard",
    "cobranza",
    "pagos",
    "avisos",
    "bienvenida",
    "notificaciones",
    "clientes",
  ],
  cliente: ["portal"],
};

// ─────────────────────────────────────────────────────────────
// AuthUser — forma canónica del usuario en el frontend.
// Normalizada a partir de la respuesta de /api/auth/me.
// ─────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string; // "active" | "inactive"
  phone?: string;
  clientId?: string; // solo para usuarios con role "cliente"
  avatarInitials: string;
  lastLogin: string; // ISO
  permissions: Permission[];
  notifications: {
    emailPayments: boolean;
    emailTickets: boolean;
    whatsapp: boolean;
    weeklyReport: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Mapeo de respuesta del backend → AuthUser
// ─────────────────────────────────────────────────────────────
function mapBackendUser(raw: {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string | null;
  phone?: string | null;
  clientId?: string | null;
  lastLoginAt?: string | null;
}): AuthUser {
  const role = raw.role as Role;
  const initials = raw.name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role,
    status: raw.status ?? "active",
    phone: raw.phone ?? undefined,
    clientId: raw.clientId ?? undefined,
    avatarInitials: initials || raw.email.slice(0, 2).toUpperCase(),
    lastLogin: raw.lastLoginAt ?? new Date().toISOString(),
    // Permisos derivados del rol (futuro: vendrán del JWT como claims)
    permissions: PERMISSIONS[role] ?? [],
    notifications: {
      emailPayments: true,
      emailTickets: true,
      whatsapp: false,
      weeklyReport: true,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  /** Solo para demo en desarrollo. En prod no aparece en la UI. */
  setRole: (r: Role) => void;
  hasPermission: (p: Permission) => boolean;
  isReadOnly: (area: "clientes" | "servicios") => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        // Si no hay token en memoria (page refresh), renovar con la cookie httpOnly
        if (!getAccessToken()) {
          const { accessToken } = await authApi.refresh();
          setAccessToken(accessToken);
        }
        const rawUser = await authApi.me();
        if (!cancelled) setUser(mapBackendUser(rawUser));
      } catch {
        setAccessToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      setRole: (r) => {
        if (user) {
          // Demo: actualiza rol Y permisos localmente (sin tocar el JWT)
          setUser({ ...user, role: r, permissions: PERMISSIONS[r] ?? [] });
        }
      },
      hasPermission: (p) => (user?.permissions ?? []).includes(p),
      isReadOnly: (area) => {
        const perms = user?.permissions ?? [];
        return perms.includes(area) && !perms.includes(`${area}:write` as Permission);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          // Limpieza garantizada aunque el endpoint falle
          setAccessToken(null);
          setUser(null);
          window.location.href = "/login";
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Versión que aserta usuario no-nulo. Usar solo dentro de AuthGuard. */
export function useAuthUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error("useAuthUser: usuario no autenticado");
  return user;
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}
