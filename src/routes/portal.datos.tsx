import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useMyClient, useUpdateMyProfile } from "@/lib/queries";
import { request } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/datos")({
  component: PortalDatos,
});

function PortalDatos() {
  const { data: client, isLoading } = useMyClient();
  const updateMutation = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync form when data loads
  useEffect(() => {
    if (client) {
      setName(client.name ?? "");
      setCompany(client.company ?? "");
      setPhone(client.phone ?? "");
      setDirty(false);
    }
  }, [client]);

  const handleSave = () => {
    updateMutation.mutate({ name, company, phone });
  };

  const handleReset = () => {
    if (client) {
      setName(client.name ?? "");
      setCompany(client.company ?? "");
      setPhone(client.phone ?? "");
      setDirty(false);
    }
  };

  // Password change
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (newPw.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setChangingPw(true);
    try {
      await request("/auth/change-password", {
        method: "POST",
        body: { oldPassword: oldPw, newPassword: newPw },
      });
      toast.success("Contraseña actualizada correctamente");
      setPwOpen(false);
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      toast.error(e.message ?? "Error al cambiar contraseña");
    } finally {
      setChangingPw(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-64 md:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="border-border/60 bg-card/60 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Mis datos de contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => { setCompany(e.target.value); setDirty(true); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              value={client?.email ?? ""}
              disabled
              className="bg-muted/40 text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">El email no se puede cambiar desde el portal.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setDirty(true); }}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} disabled={!dirty || updateMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">ID de cliente</p>
            <p className="font-mono text-xs break-all">{client?.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliente desde</p>
            <p>{formatDate(client?.createdAt) ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="capitalize">{client?.status === "activo" ? "Activo" : client?.status}</p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPwOpen(true)}
          >
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>

      {/* Password change dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Contraseña actual</Label>
              <div className="relative">
                <Input
                  type={showOld ? "text" : "password"}
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowOld((v) => !v)}
                >
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nueva contraseña</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleChangePassword}
              disabled={!oldPw || !newPw || !confirmPw || changingPw}
            >
              {changingPw ? "Cambiando…" : "Cambiar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
