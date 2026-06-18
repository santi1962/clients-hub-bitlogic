import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, AlertTriangle, Trash2, RotateCw, Mail } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/mock-data";
import { useDomains, useDeleteDomain, useCreateDomain } from "@/lib/queries";
import { useState } from "react";

export const Route = createFileRoute("/_admin/dominios")({
  head: () => ({ meta: [{ title: "Dominios — Bitlogic" }] }),
  component: DominiosPage,
});

function DominiosPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expiringInDays, setExpiringInDays] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    expirationDate: "",
    annualCost: "0",
    customerPrice: "0",
    autoRenew: false,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({
    clientId: "",
    domain: "",
    expirationDate: "",
    registrar: "default",
    autoRenew: false,
  });

  const { data, isLoading, isError } = useDomains({
    search: search || undefined,
    status: status || undefined,
    expiringInDays: expiringInDays ? parseInt(expiringInDays) : undefined,
  });

  const deleteMutation = useDeleteDomain();
  const createMutation = useCreateDomain();
  const domains = data?.data ?? [];

  const handleViewDomain = (domain) => {
    setSelectedDomain(domain);
    setEditData({
      expirationDate: domain.expirationDate,
      annualCost: domain.annualCost?.toString() || "0",
      customerPrice: domain.customerPrice?.toString() || "0",
      autoRenew: domain.autoRenew || false,
    });
  };

  const daysUntil = (expiration: string) => {
    const diff = new Date(expiration).getTime() - Date.now();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dominios</h1>
          <p className="text-sm text-muted-foreground">Gestiona todos los dominios registrados.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Agregar dominio
        </Button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Error al cargar dominios.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <Input
            placeholder="ej: ejemplo.com"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Estado</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="proximo_a_vencer">Próximo a vencer</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Vence en</label>
          <Select value={expiringInDays} onValueChange={setExpiringInDays}>
            <SelectTrigger>
              <SelectValue placeholder="Cualquier fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Cualquier fecha</SelectItem>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Listado de dominios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : domains.length === 0 ? (
            <EmptyState title="Sin dominios" description="No hay dominios disponibles." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((d) => {
                  const days = daysUntil(d.expirationDate);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.domain}</TableCell>
                      <TableCell>{d.clientCompany ?? "—"}</TableCell>
                      <TableCell>
                        {formatDate(d.expirationDate)}
                        <div className="text-xs text-muted-foreground">{days}d</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleViewDomain(d)}>
                          Ver
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

      <Dialog open={!!selectedDomain} onOpenChange={(open) => !open && setSelectedDomain(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar dominio</DialogTitle>
            <DialogDescription>{selectedDomain?.domain}</DialogDescription>
          </DialogHeader>
          {selectedDomain && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={editData.expirationDate}
                  onChange={(e) => setEditData({ ...editData, expirationDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Costo anual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.annualCost}
                  onChange={(e) => setEditData({ ...editData, annualCost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Precio al cliente</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editData.customerPrice}
                  onChange={(e) => setEditData({ ...editData, customerPrice: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={editData.autoRenew}
                  onChange={(e) => setEditData({ ...editData, autoRenew: e.target.checked })}
                  className="rounded border-border"
                />
                <Label htmlFor="autoRenew" className="cursor-pointer">
                  Auto renovación activada
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDomain(null)}>
              Cancelar
            </Button>
            <Button onClick={() => setSelectedDomain(null)}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear dominio */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar nuevo dominio</DialogTitle>
            <DialogDescription>Registra un nuevo dominio en el sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre del dominio</Label>
              <Input
                placeholder="ej: ejemplo.com"
                value={createData.domain}
                onChange={(e) => setCreateData({ ...createData, domain: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                value={createData.expirationDate}
                onChange={(e) => setCreateData({ ...createData, expirationDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Registrador</Label>
              <Input
                placeholder="ej: NIC, Donweb, etc"
                value={createData.registrar}
                onChange={(e) => setCreateData({ ...createData, registrar: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRenewCreate"
                checked={createData.autoRenew}
                onChange={(e) => setCreateData({ ...createData, autoRenew: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="autoRenewCreate" className="cursor-pointer">
                Auto renovación activada
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (createData.domain && createData.expirationDate) {
                  createMutation.mutate(
                    {
                      domain: createData.domain,
                      expirationDate: createData.expirationDate,
                      registrar: createData.registrar,
                      autoRenew: createData.autoRenew,
                    },
                    {
                      onSuccess: () => {
                        setCreateOpen(false);
                        setCreateData({ clientId: "", domain: "", expirationDate: "", registrar: "default", autoRenew: false });
                      },
                    }
                  );
                }
              }}
              disabled={createMutation.isPending || !createData.domain || !createData.expirationDate}
            >
              {createMutation.isPending ? "Agregando..." : "Agregar dominio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
