// ============================================================
// PORTAL DEL CLIENTE — layout
// ------------------------------------------------------------
// Reglas de acceso:
//   role === "cliente"         → portal normal con user.clientId
//   staff con clientId         → portal de ese cliente (uso interno)
//   staff sin clientId         → redirige a /clientes (no hay modo demo)
//   sin autenticación          → muestra el login del portal INLINE (no es
//                                 una ruta separada: /portal/login anidaría
//                                 bajo este mismo layout y el guard de acá
//                                 abajo la volvería a bloquear a sí misma).
//                                 Login propio, con contraseña — separado
//                                 del SSO de staff en /login.
// ============================================================

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";
import { useMyClient } from "@/lib/queries";
import { authApi, setAccessToken } from "@/lib/api-client";
import { BRAND } from "@/lib/brand";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

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
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

/**
 * Guard: verifica sesión y acceso al portal.
 * - Sin sesión → /login
 * - Staff sin cliente vinculado → /clientes (no hay modo demo)
 */
function PortalGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      const isCliente = user.role === "cliente";
      const hasClientId = Boolean(user.clientId);

      if (!isCliente && !hasClientId) {
        toast.error(
          "Este usuario no tiene un cliente vinculado. Creá un acceso de portal desde la ficha del cliente en Usuarios y permisos.",
        );
        navigate({ to: "/clientes" as any, replace: true });
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

  if (!user) return <PortalLoginForm />;

  const isCliente = user.role === "cliente";
  const hasClientId = Boolean(user.clientId);
  if (!isCliente && !hasClientId) return null; // redirigiendo a /clientes

  return <PortalContent user={user} />;
}

function PortalContent({ user }: { user: AuthUser }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isStaff = user.role !== "cliente";

  const { data: client, isLoading: clientLoading } = useMyClient();

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

        <Outlet />
      </main>
    </div>
  );
}

/**
 * Login del portal — con contraseña propia, SIN SSO (los clientes no tienen
 * cuenta en Bitiando; eso es solo para el staff, ver /login). Se renderiza
 * inline en vez de vivir en su propia ruta /portal/login: una ruta hija acá
 * quedaría bajo este mismo layout/guard y se bloquearía a sí misma.
 */
function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Ingresá email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const { accessToken } = await authApi.login({ email, password, remember });
      setAccessToken(accessToken);
      toast.success(BRAND.messages.welcome);
      // No hace falta navegar: setAccessToken dispara el refetch de sesión
      // (ver auth.tsx) y PortalGuard re-renderiza con user ya seteado.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-2">
        <div className="hidden flex-col justify-between border-r border-border/60 p-10 lg:flex">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 128 128" className="h-10 w-10" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 50 20 L 20 64 L 50 108" />
                <path d="M 78 20 L 108 64 L 78 108" />
              </g>
            </svg>
            <div className="text-2xl font-bold tracking-tight">{BRAND.companyName}</div>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">Portal del cliente</h1>
            <p className="max-w-md text-sm text-muted-foreground">{BRAND.slogan}</p>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {BRAND.messages.copyright} · v{BRAND.version}
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <form
            onSubmit={submit}
            className="w-full max-w-sm space-y-6 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-xl backdrop-blur"
          >
            <div className="space-y-1 text-center lg:hidden">
              <svg viewBox="0 0 128 128" className="mx-auto h-10 w-10" xmlns="http://www.w3.org/2000/svg">
                <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 35 20 L 10 64 L 35 108" />
                  <path d="M 93 20 L 118 64 L 93 108" />
                </g>
              </svg>
              <div className="pt-1 text-sm font-semibold">Bitlogic</div>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Portal del cliente</h2>
              <p className="text-xs text-muted-foreground">Accedé para ver tus dominios, hosting y pagos.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="portal-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="portal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="portal-pwd">Contraseña</Label>
                  <Link to="/recuperar" className="text-[11px] text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="portal-pwd"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="px-9"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Recordarme en este dispositivo
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Ingresando…"
              ) : (
                <>
                  Ingresar <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="space-y-2 border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
              <div>
                ¿Sos parte del equipo?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Ir al panel interno
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
