import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import { toast } from "sonner";
import { KeyRound, User, Mail, Phone, Bell } from "lucide-react";

export const Route = createFileRoute("/_admin/perfil")({
  head: () => ({ meta: [{ title: "Mi perfil — Bitlogic" }] }),
  component: ProfilePage,
});

/**
 * BACKEND:
 *  - GET /api/me → datos del usuario actual
 *  - PATCH /api/me → actualiza nombre, teléfono, preferencias
 *  - POST /api/me/password → cambia contraseña (requiere actual)
 *  - PATCH /api/me/notifications → preferencias de canales
 */
function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [notif, setNotif] = useState(user.notifications);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const save = () => {
    setUser({ ...user, name, phone, notifications: notif });
    toast.success("Perfil actualizado");
  };
  const changePwd = () => {
    if (!currentPwd || newPwd.length < 8 || newPwd !== confirmPwd) {
      toast.error("Verificá la contraseña actual y que la nueva tenga 8+ caracteres.");
      return;
    }
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    toast.success("Contraseña actualizada");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná tu información personal, contraseña y notificaciones.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-2xl font-semibold text-primary">
              {user.avatarInitials}
            </div>
            <CardTitle className="pt-2 text-base">{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABEL[user.role]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Último acceso</span>
              <span className="text-foreground">Hoy</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Sesiones activas</span>
              <span className="text-foreground">1</span>
            </div>
            <div className="flex items-center justify-between">
              <span>2FA</span>
              <span className="text-foreground">Desactivado</span>
            </div>
            <Separator className="my-2" />
            <p className="text-[11px]">
              Backend: estos datos llegarán desde <code>GET /api/me</code>.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Datos personales
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Teléfono
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 …"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Input value={ROLE_LABEL[user.role]} disabled />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={save}>Guardar cambios</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Cambiar contraseña
              </CardTitle>
              <CardDescription>
                Mínimo 8 caracteres. Se cerrarán otras sesiones activas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Actual</Label>
                <Input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nueva</Label>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar</Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <Button variant="outline" onClick={changePwd}>
                  Actualizar contraseña
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Preferencias de notificaciones
              </CardTitle>
              <CardDescription>Elegí qué eventos querés recibir y por qué canal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { k: "emailPayments", label: "Email — Pagos y vencimientos" },
                { k: "emailTickets", label: "Email — Tickets de soporte" },
                { k: "whatsapp", label: "WhatsApp — Alertas urgentes" },
                { k: "weeklyReport", label: "Reporte semanal de operación" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="text-sm">{row.label}</span>
                  <Switch
                    checked={(notif as any)[row.k]}
                    onCheckedChange={(v) => setNotif({ ...notif, [row.k]: v })}
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={save}>Guardar preferencias</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
