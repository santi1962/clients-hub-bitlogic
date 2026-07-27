import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { useMyNotices } from "@/lib/queries";
import { mpApi } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/avisos")({
  component: PortalAvisos,
});

function PortalAvisos() {
  const { data, isLoading } = useMyNotices();
  const items = (data?.data ?? []).slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const [payingId, setPayingId] = useState<string | null>(null);

  const handlePagar = async (noticeId: string) => {
    setPayingId(noticeId);
    try {
      const { checkoutUrl } = await mpApi.createCheckout(noticeId);
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast.error(err?.message ?? "Error al iniciar el pago. Intentá de nuevo.");
      setPayingId(null);
    }
  };

  const PAGABLE = new Set(["pendiente", "enviado", "vencido"]);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Mis avisos de pago</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Sin avisos" description="No tenés avisos de pago activos." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {n.noticeNumber}
                  </TableCell>
                  <TableCell>{formatPeriod(n.period)}</TableCell>
                  <TableCell className="text-muted-foreground">{n.serviceDomain ?? "—"}</TableCell>
                  <TableCell>{formatDate(n.issuedAt)}</TableCell>
                  <TableCell>{formatDate(n.dueAt)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(n.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={n.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {PAGABLE.has(n.status) && (
                      <Button
                        size="sm"
                        disabled={payingId === n.id}
                        onClick={() => handlePagar(n.id)}
                      >
                        {payingId === n.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CreditCard className="h-3 w-3" />
                        )}
                        Pagar online
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
