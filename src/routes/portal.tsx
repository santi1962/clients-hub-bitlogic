// ============================================================
// PORTAL DEL CLIENTE — layout
// ------------------------------------------------------------
// Reglas de acceso:
//   role === "cliente"         → portal normal con user.clientId
//   staff con clientId         → portal de ese cliente (uso interno)
//   staff sin clientId         → modo demo con DEMO_CLIENT_ID + aviso
//   sin autenticación          → redirige a /login
// ============================================================

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Zap,
  ArrowLeft,
  LayoutDashboard,
  Globe,
  Wallet,
  FileText,
  LifeBuoy,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import { useClient } from "@/lib/queries";

// Para subrutas del portal (portal.datos, portal.dominios, etc)
// En desarrollo, DEMO_CLIENT_ID permite testing sin datos reales
export const DEMO_CLIENT_ID = import.meta.env.PROD ? null : "c3";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "Portal del cliente — Bitlogic" }] }),
  component: PortalLayout,
});

const navItems: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/portal", label: "Mis servicios", icon: LayoutDashboard, exact: true },
  { to: "/portal/dominios", label: "Mis dominios", icon: Globe },
  { to: "/portal/pagos", label: "Mis pagos", icon: Wallet },
  { to: "/portal/avisos", label: "Mis avisos", icon: FileText },
  { to: "/portal/tickets", label: "Mis tickets", icon: LifeBuoy },
  { to: "/portal/datos", label: "Mis datos", icon: User },
];

function PortalLayout() {
  return (
    <AuthProvider>
      <PortalGuard />
    </AuthProvider>
  );
}

/**
 * Guard: verifica sesión y acceso al portal.
 * - Sin sesión → /login
 * - Con sesión → decide si mostrar demo notice o rechazar sin clientId en prod
 */
function PortalGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    // En producción, requiere clientId real (no permitir demo)
    if (!loading && user && import.meta.env.PROD) {
      const isCliente = user.role === "cliente";
      const hasClientId = Boolean(user.clientId);

      if (!isCliente && !hasClientId) {
        navigate({ to: "/", replace: true });
        return;
      }
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando portal…</span>
        </div>
      </div>
    );
  }

  if (!user) return null; // redirigiendo a /login

  const isCliente = user.role === "cliente";
  const hasClientId = Boolean(user.clientId);

  // Staff sin clientId vinculado → modo demo explícito (solo en DEV)
  const isDemoMode = !import.meta.env.PROD && !isCliente && !hasClientId;

  return <PortalContent user={user} isDemoMode={isDemoMode} />;
}

function PortalContent({ user, isDemoMode }: { user: AuthUser; isDemoMode: boolean }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isStaff = user.role !== "cliente";

  // Usar clientId real del usuario
  const clientId = user.clientId;
  const { data: client, isLoading: clientLoading } = useClient(clientId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_18px_-2px_var(--color-primary)]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Bitlogic</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Portal del cliente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{client?.company || (clientLoading ? "..." : "—")}</p>
              <p className="text-xs text-muted-foreground">{client?.email || (clientLoading ? "..." : "—")}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent text-sm font-semibold">
              {client?.company ? client.company.slice(0, 2).toUpperCase() : "?"}
            </div>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-3 pb-1">
          <div className="flex flex-wrap gap-1">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as any}
                  className={cn(
                    "flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-sm transition",
                    active
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-4">
        {/* Botón volver al admin (solo para staff) */}
        {isStaff && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Volver al admin
            </Link>
          </Button>
        )}

        {/* Aviso de modo demo (staff sin clientId vinculado) */}
        {isDemoMode && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-medium">Modo demo:</span> tu usuario no tiene un cliente
              vinculado. Se muestra el cliente de ejemplo como referencia. Para vincular un cliente
              real, editá el usuario desde{" "}
              <Link to="/usuarios" className="underline hover:no-underline">
                Usuarios y permisos
              </Link>
              .
            </div>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
