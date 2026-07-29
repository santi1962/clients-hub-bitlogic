import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, AlertTriangle, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import {
  usePayments,
  useMarkPaymentPaid,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
} from "@/lib/queries";
import { methodToDb, paymentStatusToDb, type MappedPayment } from "@/lib/api-mappers";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/pagos")({
  head: () => ({ meta: [{ title: "Pagos — Bitlogic" }] }),
  component: PaymentsPage,
});

const METHODS = ["MercadoPago", "PayPal", "Transferencia", "Efectivo", "Manual"];

function PaymentsPage() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError } = usePayments(
    statusFilter !== "all" ? { status: statusFilter } : {},
  );
  const payments = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  const markPaidMutation = useMarkPaymentPaid();
  const createPaymentMutation = useCreatePayment();
  const updatePaymentMutation = useUpdatePayment();
  const deletePaymentMutation = useDeletePayment();

  const [form, setForm] = useState({
    clientId: "",
    amount: "",
    method: "Transferencia",
    paidAt: new Date().toISOString().slice(0, 10),
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
  });

  const handleCreate = () => {
    if (!form.clientId || !form.amount) {
      toast.error("Completá cliente y monto");
      return;
    }
    createPaymentMutation.mutate(
      {
        clientId: form.clientId,
        periodMonth: form.periodMonth,
        periodYear: form.periodYear,
        amount: parseFloat(form.amount),
        method: methodToDb(form.method),
        paidAt: form.paidAt,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  const [editOpen, setEditOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<MappedPayment | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    method: "Transferencia",
    status: "pendiente",
    paidAt: "",
  });

  const openEditDialog = (p: MappedPayment) => {
    setPaymentToEdit(p);
    setEditForm({
      amount: String(p.amount),
      method: p.method,
      status: p.status,
      paidAt: p.paidAt ?? "",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!paymentToEdit) return;
    if (!editForm.amount) {
      toast.error("Completá el monto");
      return;
    }
    updatePaymentMutation.mutate(
      {
        id: paymentToEdit.id,
        patch: {
          amount: parseFloat(editForm.amount),
          method: methodToDb(editForm.method),
          status: paymentStatusToDb(editForm.status),
          paidAt: editForm.paidAt || null,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    try {
      await deletePaymentMutation.mutateAsync(paymentToDelete);
      setDeleteOpen(false);
      setPaymentToDelete(null);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${total} registros de cobranza.`}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Registrar pago
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pago</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>ID de cliente *</Label>
                <Input
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  placeholder="UUID del cliente"
                />
                <p className="text-xs text-muted-foreground">
                  Usá el ID del cliente desde la lista de clientes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Monto (USD) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Método</Label>
                  <Select
                    value={form.method}
                    onValueChange={(v) => setForm({ ...form, method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Mes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={form.periodMonth}
                    onChange={(e) => setForm({ ...form, periodMonth: parseInt(e.target.value) })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Año</Label>
                  <Input
                    type="number"
                    value={form.periodYear}
                    onChange={(e) => setForm({ ...form, periodYear: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending ? "Registrando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar los pagos. Verificá que el backend esté corriendo.
        </div>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Movimientos</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[180px] bg-muted/20 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Fecha de pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No hay pagos que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.clientCompany ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.serviceDomain ?? "—"}
                    </TableCell>
                    <TableCell>{formatPeriod(p.periodMonth)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{formatDate(p.paidAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(p.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.status !== "pagado" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={markPaidMutation.isPending}
                            onClick={() => markPaidMutation.mutate(p.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Marcar pagado
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPaymentToDelete(p.id);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pago</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Monto (USD) *</Label>
                <Input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Método</Label>
                <Select
                  value={editForm.method}
                  onValueChange={(v) => setEditForm({ ...editForm, method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Fecha de pago</Label>
                <Input
                  type="date"
                  value={editForm.paidAt}
                  onChange={(e) => setEditForm({ ...editForm, paidAt: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updatePaymentMutation.isPending}>
              {updatePaymentMutation.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePaymentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePaymentMutation.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
