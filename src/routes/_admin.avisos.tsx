import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye, Plus, Printer, Zap, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatLongDate, formatMoney, formatPeriod } from "@/lib/mock-data";
import { useNotices, useSendNotice, useCancelNotice } from "@/lib/queries";
import type { MappedNotice } from "@/lib/api-mappers";
import { noticesApi } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/avisos")({
  head: () => ({ meta: [{ title: "Avisos de pago — Bitlogic" }] }),
  component: NoticesPage,
});

// ── Documento de aviso ───────────────────────────────────────
function NoticeDocument({ n }: { n: MappedNotice }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white text-zinc-900 shadow-2xl">
      <div className="flex items-start justify-between border-b border-zinc-200 p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[oklch(0.62_0.22_255)] text-white">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Bitlogic</p>
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">
              Diseño web · Hosting
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Aviso de pago</p>
          <p className="font-mono text-sm font-semibold">#{n.noticeNumber}</p>
          <div className="mt-1">
            <StatusBadge status={n.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 border-b border-zinc-200 p-8">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Facturar a</p>
          <p className="mt-2 text-base font-semibold">{n.clientCompany}</p>
          <p className="text-sm text-zinc-600">{n.clientName}</p>
          <p className="text-sm text-zinc-600">{n.clientEmail}</p>
          <p className="text-sm text-zinc-600">{n.clientPhone}</p>
        </div>
        <div className="text-right">
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <p className="text-zinc-500">Fecha de emisión</p>
            <p className="font-medium">{formatLongDate(n.issuedAt)}</p>
            <p className="text-zinc-500">Fecha de vencimiento</p>
            <p className="font-medium">{formatLongDate(n.dueAt)}</p>
            <p className="text-zinc-500">Período facturado</p>
            <p className="font-medium">{formatPeriod(n.period)}</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-widest text-zinc-500">
              <th className="pb-2 font-medium">Descripción</th>
              <th className="pb-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-100">
              <td className="py-4">
                <p className="font-semibold">Hosting plan {n.planName ?? "—"}</p>
                <p className="text-xs text-zinc-500">Dominio: {n.serviceDomain}</p>
                <p className="text-xs text-zinc-500">Período: {formatPeriod(n.period)}</p>
              </td>
              <td className="py-4 text-right font-medium">{formatMoney(n.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-6 text-right text-sm text-zinc-500">Total a pagar</td>
              <td className="pt-6 text-right text-2xl font-semibold">{formatMoney(n.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 p-6 text-xs text-zinc-500">
        <p>
          Gracias por confiar en Bitlogic. Para consultas escribinos a{" "}
          <span className="font-medium text-zinc-700">facturacion@bitlogic.dev</span>.
        </p>
        <p className="mt-1">
          Este aviso vence el {formatLongDate(n.dueAt)}. Pasada esa fecha el servicio puede ser
          suspendido.
        </p>
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
function NoticesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data, isLoading, isError } = useNotices(
    statusFilter !== "all" ? { status: statusFilter } : {},
  );
  const notices = data?.data ?? [];
  const preview = notices.find((n) => n.id === previewId) ?? null;

  const sendMutation = useSendNotice();
  const cancelMutation = useCancelNotice();

  const handlePdf = async (id: string) => {
    try {
      const res = await noticesApi.pdf(id);
      toast.info(res.message);
    } catch {
      toast.error("Error al generar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Avisos de pago</h1>
          <p className="text-sm text-muted-foreground">Comunicaciones enviadas a clientes.</p>
        </div>
        <Button onClick={() => toast.info("Usá el workflow 'Generar aviso' para crear avisos")}>
          <Plus className="h-4 w-4" /> Generar aviso
        </Button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar los avisos. Verificá que el backend esté corriendo.
        </div>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Listado</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[180px] bg-muted/20 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : notices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No hay avisos que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                notices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {n.noticeNumber}
                    </TableCell>
                    <TableCell className="font-medium">{n.clientCompany ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {n.serviceDomain ?? "—"}
                    </TableCell>
                    <TableCell>{formatPeriod(n.period)}</TableCell>
                    <TableCell>{formatDate(n.issuedAt)}</TableCell>
                    <TableCell>{formatDate(n.dueAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(n.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPreviewId(n.id)}>
                          <Eye className="h-4 w-4" /> Ver
                        </Button>
                        {(n.status === "pendiente" || n.status === "borrador") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={sendMutation.isPending}
                            onClick={() => sendMutation.mutate(n.id)}
                          >
                            <Send className="h-4 w-4" /> Enviar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handlePdf(n.id)}>
                          <Download className="h-4 w-4" /> PDF
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

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreviewId(null)}>
        <DialogContent className="max-w-3xl border-border/60 bg-card p-0 [&>button]:text-zinc-500">
          <DialogHeader className="border-b border-border/60 p-4">
            <div className="flex items-center justify-between">
              <DialogTitle>Vista previa — {preview?.noticeNumber}</DialogTitle>
              <div className="flex gap-2 mr-8">
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button size="sm" onClick={() => preview && handlePdf(preview.id)}>
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto bg-muted/30 p-6">
            {preview && <NoticeDocument n={preview} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
