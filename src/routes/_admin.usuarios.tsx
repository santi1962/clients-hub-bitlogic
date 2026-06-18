import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/components/permission-guard";
import { ROLE_LABEL, permissionsFor, type Role, useAuth } from "@/lib/auth";
import { useClients } from "@/lib/queries";
import { MoreHorizontal, UserPlus, Shield, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios y permisos — Bitlogic" }] }),
  component: () => (
    <PermissionGuard permission="usuarios">
      <UsersPage />
    </PermissionGuard>
  ),
});

/**
 * BACKEND:
 *  - GET /api/users (internos), GET /api/portal-users (clientes con acceso)
 *  - POST /api/users/invite { email, role }  → genera token de invitación
 *  - PATCH /api/users/:id { status, role }
 *  - Roles y permisos: la matriz vive en backend, espejada en `src/lib/auth.tsx`.
 */

interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "activo" | "inactivo" | "invitado";
  lastLogin: string;
}

const INITIAL_INTERNAL: InternalUser[] = [];

function StatusPill({ status }: { status: InternalUser["status"] }) {
  const map = {
    activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    inactivo: "bg-muted text-muted-foreground border-border",
    invitado: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

function UsersPage() {
  const { user: me } = useAuth();
  const { data: clientsData } = useClients();
  const [internal, setInternal] = useState<InternalUser[]>(INITIAL_INTERNAL);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("soporte");

  const filteredInternal = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return internal;
    return internal.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABEL[u.role].toLowerCase().includes(q),
    );
  }, [internal, query]);

  const portalUsers = useMemo(
    () =>
      (clientsData?.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        lastLogin: "—",
        status: c.status === "activo" ? "activo" : ("inactivo" as InternalUser["status"]),
      })),
    [clientsData?.data],
  );

  const setStatus = (id: string, status: InternalUser["status"]) => {
    setInternal((arr) => arr.map((u) => (u.id === id ? { ...u, status } : u)));
    toast.success(
      `Usuario ${status === "activo" ? "activado" : status === "inactivo" ? "desactivado" : "actualizado"}`,
    );
  };
  const setRole = (id: string, role: Role) => {
    setInternal((arr) => arr.map((u) => (u.id === id ? { ...u, role } : u)));
    toast.success("Rol actualizado");
  };
  const sendInvite = () => {
    if (!inviteEmail) return;
    setInternal((arr) => [
      ...arr,
      {
        id: `u-${Math.random().toString(36).slice(2, 6)}`,
        name: inviteEmail.split("@")[0],
        email: inviteEmail,
        role: inviteRole,
        status: "invitado",
        lastLogin: "—",
      },
    ]);
    setInviteEmail("");
    setInviteOpen(false);
    toast.success("Invitación enviada");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios y permisos</h1>
          <p className="text-sm text-muted-foreground">
            Equipo interno y clientes con acceso al portal.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Invitar usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitar a un nuevo usuario</DialogTitle>
              <DialogDescription>
                Recibirá un email con un enlace para crear su contraseña.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="persona@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as Role[])
                      .filter((r) => r !== "cliente")
                      .map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={sendInvite}>Enviar invitación</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="internos">
        <TabsList>
          <TabsTrigger value="internos">Internos ({internal.length})</TabsTrigger>
          <TabsTrigger value="portal">Clientes con portal ({portalUsers.length})</TabsTrigger>
          <TabsTrigger value="roles">Matriz de roles</TabsTrigger>
        </TabsList>

        <TabsContent value="internos" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o rol…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInternal.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            {u.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <div className="leading-tight">
                            <div className="text-sm font-medium">
                              {u.name}
                              {u.id === me.id && (
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                  (vos)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={u.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            {u.status !== "activo" && (
                              <DropdownMenuItem onClick={() => setStatus(u.id, "activo")}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Activar
                              </DropdownMenuItem>
                            )}
                            {u.status === "activo" && (
                              <DropdownMenuItem onClick={() => setStatus(u.id, "inactivo")}>
                                <XCircle className="mr-2 h-4 w-4" /> Desactivar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => toast.success("Invitación reenviada")}>
                              <UserPlus className="mr-2 h-4 w-4" /> Reenviar invitación
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              Cambiar rol
                            </DropdownMenuLabel>
                            {(Object.keys(ROLE_LABEL) as Role[])
                              .filter((r) => r !== "cliente")
                              .map((r) => (
                                <DropdownMenuItem key={r} onClick={() => setRole(u.id, r)}>
                                  <Shield className="mr-2 h-4 w-4" /> {ROLE_LABEL[r]}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes con acceso al portal</CardTitle>
              <CardDescription>
                Usuarios con rol <Badge variant="secondary">Cliente</Badge> que pueden ingresar a{" "}
                <code>/portal</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <StatusPill status={u.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.success("Invitación enviada al cliente")}
                        >
                          Enviar invitación
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matriz de roles y permisos</CardTitle>
              <CardDescription>
                Visualización del acceso a cada sección por rol. La lógica final vivirá en el
                backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <div key={r} className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">{ROLE_LABEL[r]}</div>
                    <Badge variant="outline" className="text-[10px]">
                      {permissionsFor(r).length} permisos
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {permissionsFor(r).map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
