import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getClient, formatDate } from "@/lib/mock-data";
import { DEMO_CLIENT_ID } from "./portal";

export const Route = createFileRoute("/portal/datos")({
  component: PortalDatos,
});

function PortalDatos() {
  const c = getClient(DEMO_CLIENT_ID)!;
  // Backend: PATCH /api/portal/me  → actualiza profile del cliente.
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="border-border/60 bg-card/60 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Mis datos de contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input defaultValue={c.name} />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Input defaultValue={c.company} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" defaultValue={c.email} />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input defaultValue={c.phone} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="outline">Cancelar</Button>
            <Button>Guardar cambios</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">ID de cliente</p>
            <p className="font-mono">{c.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliente desde</p>
            <p>{formatDate(c.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="capitalize">{c.status}</p>
          </div>
          <Button variant="outline" className="w-full">
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
