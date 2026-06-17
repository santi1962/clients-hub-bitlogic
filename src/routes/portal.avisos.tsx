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
import { formatDate, formatMoney, formatPeriod } from "@/lib/mock-data";
import { useNotices } from "@/lib/queries";
import { useAuthUser } from "@/lib/auth";
import { DEMO_CLIENT_ID } from "./portal";

export const Route = createFileRoute("/portal/avisos")({
  component: PortalAvisos,
});

function PortalAvisos() {
  const user = useAuthUser();
  const clientId = user.clientId ?? DEMO_CLIENT_ID;

  const { data, isLoading } = useNotices({ clientId });
  const items = (data?.data ?? []).slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
