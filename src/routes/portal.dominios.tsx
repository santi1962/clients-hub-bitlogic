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
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/mock-data";
import { useDomains } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { DEMO_CLIENT_ID } from "./portal";

export const Route = createFileRoute("/portal/dominios")({
  component: PortalDominios,
});

function PortalDominios() {
  const { user } = useAuth();
  const clientId = user?.clientId ?? DEMO_CLIENT_ID;
  const { data: domainsData, isLoading, isError } = useDomains({ clientId });
  const domains = domainsData?.data ?? [];

  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis dominios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis dominios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">Error al cargar los dominios.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user?.clientId) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis dominios</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Sin acceso a dominios"
            description="No tienes un cliente asignado. Contacta a soporte."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Mis dominios</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {domains.length === 0 ? (
          <EmptyState
            title="Sin dominios"
            description="Aún no tenés dominios registrados con nosotros."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dominio</TableHead>
                <TableHead>Registrador</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Auto-ren.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Precio anual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => {
                const daysUntil = Math.round(
                  (new Date(d.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell className="text-muted-foreground">{d.registrar ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatDate(d.expirationDate)}</span>
                        <span
                          className={
                            "text-[11px] " +
                            (daysUntil < 0
                              ? "text-destructive"
                              : daysUntil <= 30
                                ? "text-warning"
                                : "text-muted-foreground")
                          }
                        >
                          {daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` : `en ${daysUntil}d`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{d.autoRenew ? "Sí" : "No"}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-right">{d.customerPrice ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
