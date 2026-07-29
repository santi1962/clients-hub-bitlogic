import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGuard } from "@/components/permission-guard";
import { ROLE_LABEL, permissionsFor, type Role } from "@/lib/auth";
import {
  usePortalUsers,
  useCreatePortalUser,
  useResetUserPassword,
  useDeletePortalUser,
} from "@/lib/queries";
import { KeyRound, UserPlus, Trash2, RefreshCw, Eye, EyeOff, Copy } from "lucide-react";
import type { PortalUserRow } from "@/lib/api-client";
import { toast } from "sonner";

function portalLoginUrl() {
  return `${window.location.origin}/login`;
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("No se pudo copiar. Copiá manualmente.");
  }
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(value, label)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios y permisos — Bitlogic" }] }),
  component: () => (
    <PermissionGuard permission="usuarios">
      <UsersPage />
    </PermissionGuard>
  ),
});

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    inactive: "bg-muted text-muted-foreground border-border",
  };
  const label = status === "active" ? "activo" : "inactivo";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? map.inactive}`}>
      {label}
    </span>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••••••"}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CreateAccessDialog({
  row,
  open,
  onClose,
}: {
  row: PortalUserRow;
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(row.email ?? "");
  const [password, setPassword] = useState(() => generatePassword());
  const mutation = useCreatePortalUser();

  const handleSubmit = () => {
    mutation.mutate(
      { clientId: row.clientId, name: row.clientCompany ?? row.clientName, email, password },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crear acceso al portal</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cliente: <span className="font-medium text-foreground">{row.clientCompany ?? row.clientName}</span>
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <PasswordInput value={password} onChange={setPassword} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPassword(generatePassword())}
            >
              <RefreshCw className="mr-1.5 h-3 w-3" /> Generar nueva
            </Button>
          </div>
          <CopyField label="Link de acceso al portal" value={portalLoginUrl()} />
          <p className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Enviále al cliente el link de arriba junto con su email y contraseña. Van a poder
            cambiar la contraseña desde el portal una vez adentro.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!email || !password || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Creando..." : "Crear acceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  row,
  open,
  onClose,
}: {
  row: PortalUserRow;
  open: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState(() => generatePassword());
  const mutation = useResetUserPassword();

  const handleSubmit = () => {
    mutation.mutate(
      { userId: row.userId!, newPassword: password },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cliente: <span className="font-medium text-foreground">{row.clientCompany ?? row.clientName}</span>
          <br />
          Email: <span className="font-medium text-foreground">{row.email}</span>
        </p>
        <div className="space-y-1.5">
          <Label>Nueva contraseña</Label>
          <PasswordInput value={password} onChange={setPassword} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setPassword(generatePassword())}
          >
            <RefreshCw className="mr-1.5 h-3 w-3" /> Generar nueva
          </Button>
        </div>
        <CopyField label="Link de acceso al portal" value={portalLoginUrl()} />
        <p className="rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground">
          Copiá la nueva contraseña y el link de arriba, y enviáselos al cliente.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!password || mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? "Restableciendo..." : "Restablecer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PortalUsersTab() {
  const { data, isLoading } = usePortalUsers();
  const deleteMutation = useDeletePortalUser();
  const [createFor, setCreateFor] = useState<PortalUserRow | null>(null);
  const [resetFor, setResetFor] = useState<PortalUserRow | null>(null);

  const rows = data?.data ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acceso al portal de clientes</CardTitle>
          <CardDescription>
            Creá credenciales para que tus clientes ingresen a <code>/portal</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email portal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.clientId}>
                    <TableCell className="font-medium">
                      {row.clientCompany ?? row.clientName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.email ?? <span className="italic text-muted-foreground/60">Sin acceso</span>}
                    </TableCell>
                    <TableCell>
                      {row.userId ? (
                        <StatusPill status={row.status} />
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          sin cuenta
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString("es-AR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!row.userId ? (
                          <Button size="sm" variant="outline" onClick={() => setCreateFor(row)}>
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Crear acceso
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setResetFor(row)}>
                              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Restablecer contraseña
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(row.userId!)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createFor && (
        <CreateAccessDialog row={createFor} open onClose={() => setCreateFor(null)} />
      )}
      {resetFor && (
        <ResetPasswordDialog row={resetFor} open onClose={() => setResetFor(null)} />
      )}
    </>
  );
}

function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios y permisos</h1>
        <p className="text-sm text-muted-foreground">
          Equipo interno y clientes con acceso al portal.
        </p>
      </div>

      <Tabs defaultValue="portal">
        <TabsList>
          <TabsTrigger value="portal">Clientes con portal</TabsTrigger>
          <TabsTrigger value="roles">Matriz de roles</TabsTrigger>
        </TabsList>

        <TabsContent value="portal" className="mt-4">
          <PortalUsersTab />
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matriz de roles y permisos</CardTitle>
              <CardDescription>
                Visualización del acceso a cada sección por rol.
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
