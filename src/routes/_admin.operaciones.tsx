import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, LifeBuoy, Globe, Wallet, Server, ListChecks, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardApi } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/mock-data";

export const Route = createFileRoute("/_admin/operaciones")({
  head: () => ({ meta: [{ title: "Centro de Operaciones — Bitlogic" }] }),
  component: OperacionesPage,
});

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <AlertCircle className="h-4 w-4 mr-2" />
      <p className="text-sm">No hay datos disponibles</p>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  count,
  to,
  color,
  children,
  isLoading,
}: {
  title: string;
  icon: any;
  count: number;
  to: string;
  color: string;
  children: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", color)}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
          {!isLoading && (
            <Badge
              variant="outline"
              className="ml-1 rounded-full bg-background/40 border-border/60 text-[10px]"
            >
              {count}
            </Badge>
          )}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" disabled={isLoading}>
          <Link to={to as any}>
            Ver todo <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function OperacionesPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard:admin"],
    queryFn: () => dashboardApi.admin(),
    staleTime: 60000,
  });

  const upcomingServices = dashboard?.upcomingServices ?? [];
  const recentPayments = dashboard?.recentPayments ?? [];
  const upcomingDomains = dashboard?.upcomingDomains ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Command className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de Operaciones</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que requiere atención hoy, en una sola pantalla.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Dominios por vencer"
          icon={Globe}
          count={upcomingDomains.length}
          to="/dominios"
          color="bg-warning/15 text-warning"
          isLoading={isLoading}
        >
          {upcomingDomains.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingDomains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell className="text-muted-foreground">{d.clientCompany}</TableCell>
                    <TableCell>{formatDate(d.expirationDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState />
          )}
        </SectionCard>

        <SectionCard
          title="Pagos pendientes"
          icon={Wallet}
          count={recentPayments.length}
          to="/pagos"
          color="bg-accent/15 text-accent"
          isLoading={isLoading}
        >
          {recentPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.slice(0, 5).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.clientCompany}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.periodMonth}/{p.periodYear}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState />
          )}
        </SectionCard>

        <SectionCard
          title="Servicios por vencer"
          icon={Server}
          count={upcomingServices.length}
          to="/servicios"
          color="bg-primary/15 text-primary"
          isLoading={isLoading}
        >
          {upcomingServices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingServices.slice(0, 5).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.domain}</TableCell>
                    <TableCell>{s.planName}</TableCell>
                    <TableCell>{formatDate(s.nextDueDate)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.monthlyPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
