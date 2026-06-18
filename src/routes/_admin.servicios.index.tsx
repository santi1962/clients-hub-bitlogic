import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, Search, Server, AlertTriangle } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/mock-data";
import { useServices, usePlans, useClients, useCreateService } from "@/lib/queries";

export const Route = createFileRoute("/_admin/servicios/")({
  head: () => ({ meta: [{ title: "Servicios de hosting — Bitlogic" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [planId, setPlanId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formulario de nuevo servicio
  const [formData, setFormData] = useState({
    clientId: "",
    domain: "",
    planId: "",
    monthlyPrice: "",
    setupDate: new Date().toISOString().split("T")[0],
    nextDueDate: "",
    storageTotalGb: "5",
    emailsTotal: "10",
  });

  // Datos para los dropdowns
  const { data: plansData } = usePlans();
  const { data: clientsData } = useClients();
  const planList = plansData?.data ?? [];
  const clientList = clientsData?.data ?? [];

  // Servicios con filtros aplicados en el backend
  const { data, isLoading, isError } = useServices({
    ...(q ? { search: q } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(planId !== "all" ? { planId } : {}),
  });

  const services = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  // Mutation para crear servicio
  const createServiceMutation = useCreateService();

  const handleCreateService = async () => {
    if (!formData.clientId || !formData.domain || !formData.planId || !formData.monthlyPrice) {
      alert("Por favor completa cliente, dominio, plan y precio");
      return;
    }

    try {
      await createServiceMutation.mutateAsync({
        clientId: formData.clientId,
        domain: formData.domain,
        planId: formData.planId,
        monthlyPrice: parseFloat(formData.monthlyPrice),
        setupDate: formData.setupDate,
        nextDueDate: formData.nextDueDate,
        storageTotalGb: parseInt(formData.storageTotalGb) || 5,
        emailsTotal: parseInt(formData.emailsTotal) || 10,
      });
      setDialogOpen(false);
      setFormData({
        clientId: "",
        domain: "",
        planId: "",
        monthlyPrice: "",
        setupDate: new Date().toISOString().split("T")[0],
        nextDueDate: "",
        storageTotalGb: "5",
        emailsTotal: "10",
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servicios de hosting</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${total} servicios en total`}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo servicio
        </Button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar los servicios. Verificá que el backend esté corriendo.
        </div>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Listado</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar dominio o cliente..."
                className="h-9 w-[280px] pl-9 bg-muted/20"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[190px] bg-muted/20">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="proximo_a_vencer">Próximo a vencer</SelectItem>
                <SelectItem value="pendiente">Pendiente de pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="h-9 w-[160px] bg-muted/20">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {planList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState
              icon={Server}
              title="Sin resultados"
              description="No hay servicios que coincidan con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[180px]">Espacio</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead>Próx. venc.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => {
                  const pct = Math.min(100, Math.round((s.usedGB / s.totalGB) * 100));
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.clientCompany ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.domain}</TableCell>
                      <TableCell>{s.planName ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-1.5" />
                          <p className="text-[11px] text-muted-foreground">
                            {s.usedGB} / {s.totalGB} GB
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(s.startDate)}</TableCell>
                      <TableCell>{formatDate(s.nextDueDate)}</TableCell>
                      <TableCell className="text-right">{formatMoney(s.monthlyPrice)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/servicios/$id" params={{ id: s.id }}>
                            <Eye className="h-4 w-4" /> Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Servicio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select
                value={formData.clientId}
                onValueChange={(val) => setFormData({ ...formData, clientId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dominio</Label>
              <Input
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="ejemplo.com"
              />
            </div>

            <div>
              <Label>Plan</Label>
              <Select
                value={formData.planId}
                onValueChange={(val) => setFormData({ ...formData, planId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona plan" />
                </SelectTrigger>
                <SelectContent>
                  {planList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Precio mensual ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monthlyPrice}
                  onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Almacenamiento (GB)</Label>
                <Input
                  type="number"
                  value={formData.storageTotalGb}
                  onChange={(e) => setFormData({ ...formData, storageTotalGb: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cuentas email</Label>
                <Input
                  type="number"
                  value={formData.emailsTotal}
                  onChange={(e) => setFormData({ ...formData, emailsTotal: e.target.value })}
                />
              </div>
              <div>
                <Label>Próximo vencimiento</Label>
                <Input
                  type="date"
                  value={formData.nextDueDate}
                  onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Fecha de alta</Label>
              <Input
                type="date"
                value={formData.setupDate}
                onChange={(e) => setFormData({ ...formData, setupDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateService}
              disabled={createServiceMutation.isPending}
            >
              {createServiceMutation.isPending ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
