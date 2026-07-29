import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { LogOut, User as UserIcon, Shield, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { AuthProvider, useAuth, ROLE_LABEL, type Role } from "@/lib/auth";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthProvider>
      <AuthGuard>
        <TooltipProvider delayDuration={200}>
          <SidebarProvider>
            <div className="flex min-h-screen w-full bg-background text-foreground">
              <AppSidebar />
              <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
                  <SidebarTrigger className="-ml-1" />
                  <div className="ml-2">
                    <GlobalSearch />
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <NotificationsBell />
                    <Button asChild variant="ghost" size="icon" aria-label="Configuración">
                      <Link to="/configuracion">
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                    <UserMenu />
                  </div>
                </header>
                <main className="flex-1 p-6">
                  <Outlet />
                </main>
              </div>
            </div>
            <Toaster richColors position="top-right" />
          </SidebarProvider>
        </TooltipProvider>
      </AuthGuard>
    </AuthProvider>
  );
}

/**
 * Guard de ruta admin:
 * - Sin sesión → /login
 * - Rol "cliente" → /portal (los clientes no tienen acceso al admin)
 * - OK → renderiza children
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
    } else if (user.role === "cliente") {
      // Los usuarios con rol cliente no deben ver el panel de administración
      navigate({ to: "/portal", replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando sesión…</span>
        </div>
      </div>
    );
  }

  // Redirigiendo (no renderizar nada mientras)
  if (!user || user.role === "cliente") return null;

  return <>{children}</>;
}

function UserMenu() {
  const { user, setRole, logout } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted/50 transition">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {user.avatarInitials}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium">{user.name}</span>
            <span className="text-[10px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm">{user.name}</span>
            <span className="text-[11px] text-muted-foreground">{user.email}</span>
            <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
              {ROLE_LABEL[user.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil">
            <UserIcon className="mr-2 h-4 w-4" /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/usuarios">
            <Shield className="mr-2 h-4 w-4" /> Usuarios y permisos
          </Link>
        </DropdownMenuItem>

        {/* ── Selector de rol: solo visible en desarrollo ───────────────── */}
        {import.meta.env.DEV && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Simular rol — solo en desarrollo
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={user.role} onValueChange={(v) => setRole(v as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {/* ─────────────────────────────────────────────────────────────── */}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
