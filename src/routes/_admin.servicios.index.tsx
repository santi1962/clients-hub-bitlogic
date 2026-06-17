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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Eye, Search, Server, AlertTriangle } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/mock-data";
import { useServices, usePlans } from "@/lib/queries";

export const Route = createFileRoute("/_admin/servicios/")({
  head: () => ({ meta: [{ title: "Servicios de hosting — Bitlogic" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [planId, setPlanId] = useState<string>("all");

  // Planes para el filtro
  const { data: plansData } = usePlans();
  const planList = plansData?.data ?? [];

  // Servicios con filtros aplicados en el backend
  const { data, isLoading, isError } = useServices({
    ...(q ? { search: q } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(planId !== "all" ? { planId } : {}),
  });

  const services = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servicios de hosting</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${total} servicios en total`}
          </p>
        </div>
        <Button>
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
    </div>
  );
}
