import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Users,
  Server,
  Wallet,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  ServerCog,
  FileText,
  CalendarClock,
  Sparkles,
  BadgeDollarSign,
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/mock-data";
import { useDashboard } from "@/lib/queries";

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export const Route = createFileRoute("/_admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Bitlogic Client Portal" }] }),
  component: Dashboard,
});

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  loading,
}: {
  label: string;
  value: string | number;
  icon: any;
  accent?: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/60 backdrop-blur">
      <div
        className={
          "absolute inset-x-0 top-0 h-px " +
          (accent ?? "bg-gradient-to-r from-transparent via-primary/60 to-transparent")
        }
      />
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-20" />
          ) : (
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          )}
          {hint && !loading && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function periodLabel(month: number, year: number) {
  return `${MONTHS_ES[month - 1]} ${year}`;
}

function Dashboard() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen general de clientes, servicios y cobranza.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/clientes">
              <UserPlus className="h-4 w-4" /> Nuevo cliente
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/servicios">
              <ServerCog className="h-4 w-4" /> Nuevo servicio
            </Link>
          </Button>
          <Button asChild>
            <Link to="/avisos">
              <FileText className="h-4 w-4" /> Generar aviso
            </Link>
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar el dashboard. Verificá que el backend esté corriendo.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Clientes activos"
          value={data?.activeClients ?? 0}
          icon={Users}
          hint={data ? `${data.newClientsThisMonth} nuevos este mes` : undefined}
          loading={isLoading}
        />
        <KpiCard
          label="Servicios activos"
          value={data?.activeServices ?? 0}
          icon={Server}
          loading={isLoading}
        />
        <KpiCard
          label="Avisos vencidos"
          value={data?.overdueNoticesCount ?? 0}
          icon={CalendarClock}
          accent="bg-gradient-to-r from-transparent via-warning/60 to-transparent"
          hint={data ? `${data.pendingPaymentsCount} pagos pendientes` : undefined}
          loading={isLoading}
        />
        <KpiCard
          label="Cobrado este mes"
          value={formatMoney(data?.collectedThisMonth ?? 0)}
          icon={Wallet}
          accent="bg-gradient-to-r from-transparent via-success/60 to-transparent"
          hint={data ? `Proyectado: ${formatMoney(data.monthlyRevenue)}` : undefined}
          loading={isLoading}
        />
        <KpiCard
          label="Deuda total"
          value={formatMoney(data?.totalDebt ?? 0)}
          icon={TrendingUp}
          accent="bg-gradient-to-r from-transparent via-destructive/60 to-transparent"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/60 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-warning" /> Próximos vencimientos
            </CardTitle>
            <Link to="/servicios" className="text-xs text-accent hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (data?.upcomingServices ?? []).length === 0 ? (
              <EmptyState
                title="Sin vencimientos próximos"
                description="Ningún servicio vence en los próximos 30 días."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dominio</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.upcomingServices ?? []).map((s) => {
                    const d = daysUntil(s.nextDueDate);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/clientes/$id"
                            params={{ id: s.clientId }}
                            className="hover:text-accent"
                          >
                            {s.clientCompany}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.domain}</TableCell>
                        <TableCell>{s.planName}</TableCell>
                        <TableCell>{formatDate(s.nextDueDate)}</TableCell>
                        <TableCell>
                          <span
                            className={
                              "text-xs font-medium " +
                              (d < 0
                                ? "text-destructive"
                                : d <= 7
                                  ? "text-warning"
                                  : "text-muted-foreground")
                            }
                          >
                            {d < 0 ? `${Math.abs(d)}d vencido` : `en ${d}d`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(s.monthlyPrice)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Clientes nuevos este mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (data?.newClientsThisMonth ?? 0) === 0 ? (
              <EmptyState
                title="Sin altas nuevas"
                description="Los clientes que se registren este mes aparecerán aquí."
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {data?.newClientsThisMonth} cliente(s) nuevo(s) registrados este mes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Clientes con deuda
            </CardTitle>
            <Link to="/cobranza" className="text-xs text-accent hover:underline">
              Ir a cobranza
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (data?.clientsWithDebt ?? []).length === 0 ? (
              <EmptyState title="Sin deudas" description="Todos los clientes están al día." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Último pago</TableHead>
                    <TableHead>Próx. venc.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Deuda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.clientsWithDebt ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/clientes/$id"
                          params={{ id: c.id }}
                          className="hover:text-accent"
                        >
                          {c.company}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(c.lastPaymentDate)}</TableCell>
                      <TableCell>{formatDate(c.nextDueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status="vencido" />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {formatMoney(c.debt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-success" /> Resumen financiero del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Cobrado</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-full" />
                ) : (
                  <p className="mt-1 text-xl font-semibold text-success">
                    {formatMoney(data?.collectedThisMonth ?? 0)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Pendiente</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-full" />
                ) : (
                  <p className="mt-1 text-xl font-semibold text-warning">
                    {formatMoney(
                      (data?.totalDebt ?? 0) - (data?.collectedThisMonth ?? 0) < 0 ? 0 : 0,
                    )}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Deuda total</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-7 w-full" />
                ) : (
                  <p className="mt-1 text-xl font-semibold text-destructive">
                    {formatMoney(data?.totalDebt ?? 0)}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-3/4" />
              ) : (
                <>
                  {(data?.clientsWithDebt ?? []).length} cliente(s) acumulan deuda por un total de{" "}
                  <span className="font-semibold text-destructive">
                    {formatMoney(data?.totalDebt ?? 0)}
                  </span>
                  .
                </>
              )}
            </div>

            {(data?.recentPayments ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Pagos recientes
                </p>
                {(data?.recentPayments ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium truncate max-w-[120px]">{p.clientCompany}</span>
                    <span className="text-muted-foreground">
                      {periodLabel(p.periodMonth, p.periodYear)}
                    </span>
                    <span className="font-semibold text-success">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
