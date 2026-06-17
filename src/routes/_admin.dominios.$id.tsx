import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft, RotateCw, Trash2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { formatDate, formatMoney } from "@/lib/mock-data";
import { useDomain, useRenewDomain, useDeleteDomain, useSendDomainReminder } from "@/lib/queries";

export const Route = createFileRoute("/_admin/dominios/$id")({
  head: () => ({ meta: [{ title: "Dominio — Bitlogic" }] }),
  component: DominioDetail,
  notFoundComponent: () => <div className="p-8">Dominio no encontrado.</div>,
});

function DominioDetail() {
  const { id } = Route.useParams();
  const { data: domain, isLoading, isError } = useDomain(id);
  const renewMutation = useRenewDomain(id);
  const deleteMutation = useDeleteDomain();
  const sendReminderMutation = useSendDomainReminder(id);

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewDate, setRenewDate] = useState("");

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !domain) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Dominio no encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dominios">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }

  const daysUntil = Math.round(
    (new Date(domain.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const annualGain = (domain.customerPrice ?? 0) - (domain.annualCost ?? 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dominios", to: "/dominios" }, { label: domain.domain }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/dominios">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{domain.domain}</h1>
            <p className="text-sm text-muted-foreground">
              {domain.clientCompany ?? domain.clientName}
            </p>
          </div>
          <StatusBadge status={domain.status} className="ml-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRenewOpen(true)}>
            <RotateCw className="h-4 w-4" /> Renovar
          </Button>
          <Button variant="outline" onClick={() => sendReminderMutation.mutate()} disabled={sendReminderMutation.isPending}>
            {sendReminderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Enviar recordatorio
          </Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate(id)}>
            <Trash2 className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Dominio</p>
              <p className="font-medium">{domain.domain}</p>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{domain.clientCompany ?? domain.clientName ?? "—"}</p>
            </div>
            {domain.serviceDomain && (
              <div className="border-t border-border/60 pt-3">
                <p className="text-xs text-muted-foreground">Servicio</p>
                <p className="font-medium">{domain.serviceDomain}</p>
              </div>
            )}
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Registrador</p>
              <p className="font-medium">{domain.registrar ?? "—"}</p>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">Auto renovación</p>
              <p className="font-medium">{domain.autoRenew ? "Activada" : "Desactivada"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Fechas y costos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Vence</p>
              <p className="mt-1 font-medium">{formatDate(domain.expirationDate)}</p>
              <p className="text-xs text-muted-foreground mt-1">{daysUntil}d restantes</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Costo anual</p>
              <p className="mt-1 font-medium">{formatMoney(domain.annualCost ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Precio cliente</p>
              <p className="mt-1 font-medium">{formatMoney(domain.customerPrice ?? 0)}</p>
            </div>
            <div
              className={`rounded-lg border p-3 ${annualGain > 0 ? "border-success/40 bg-success/10" : "border-border/60 bg-background/40"}`}
            >
              <p className="text-[11px] uppercase text-muted-foreground">Ganancia anual</p>
              <p
                className={`mt-1 font-semibold ${annualGain > 0 ? "text-success" : "text-muted-foreground"}`}
              >
                {formatMoney(annualGain)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar dominio</DialogTitle>
            <DialogDescription>Actualiza la fecha de vencimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nueva fecha de vencimiento</Label>
              <Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                renewMutation.mutate(
                  { newExpirationDate: renewDate },
                  { onSuccess: () => setRenewOpen(false) },
                )
              }
              disabled={!renewDate || renewMutation.isPending}
            >
              {renewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
