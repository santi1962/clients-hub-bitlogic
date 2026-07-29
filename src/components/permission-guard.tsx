import { ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth, ROLE_LABEL, type Permission } from "@/lib/auth";

/**
 * Visual guard. Cuando el backend esté listo, este componente puede:
 *  - leer permisos desde claims del JWT
 *  - redirigir vía router (throw redirect en beforeLoad) en vez de renderizar fallback
 */
export function PermissionGuard({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { hasPermission, user } = useAuth();
  if (hasPermission(permission)) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/40 p-10 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Acceso restringido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu rol actual <span className="font-medium text-foreground">{user ? ROLE_LABEL[user.role] : ""}</span>{" "}
          no tiene permisos para acceder a esta sección.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Contactá a un administrador si necesitás acceso.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}

export function ReadOnlyNotice({ area }: { area: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
      Estás viendo {area} en <span className="font-semibold">modo lectura</span>. Tu rol no permite
      editar.
    </div>
  );
}
