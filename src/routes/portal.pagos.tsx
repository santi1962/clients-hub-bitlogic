import { createFileRoute } from "@tanstack/react-router";
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
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { useMyPayments } from "@/lib/queries";

export const Route = createFileRoute("/portal/pagos")({
  component: PortalPagos,
});

function PortalPagos() {
  const { data, isLoading } = useMyPayments();
  const items = (data?.data ?? [])
    .slice()
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Mis pagos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Sin pagos" description="Aún no se registraron pagos." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatPeriod(p.periodMonth)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.serviceDomain ?? "—"}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{formatDate(p.paidAt)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
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
