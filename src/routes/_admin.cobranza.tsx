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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CalendarClock,
  BadgeDollarSign,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/mock-data";
import { useBillingSummary } from "@/lib/queries";

export const Route = createFileRoute("/_admin/cobranza")({
  head: () => ({ meta: [{ title: "Cobranza — Bitlogic" }] }),
  component: CobranzaPage,
});

const CHART_COLORS = [
  "oklch(0.62 0.22 255)",
  "oklch(0.78 0.12 230)",
  "oklch(0.78 0.16 75)",
  "oklch(0.7 0.16 155)",
  "oklch(0.62 0.22 25)",
];

function Metric({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/60">
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
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          )}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// Spanish month abbreviations for chart labels
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

function CobranzaPage() {
  const { data: summary, isLoading, isError } = useBillingSummary();

  const revenue = (summary?.revenueLast12Months ?? []).map((r) => ({
    m: `${MONTHS_ES[r.month - 1]} ${String(r.year).slice(2)}`,
    v: r.total,
  }));

  const pvp = summary?.paidVsPending ?? [];
  const dist = summary?.planDistribution ?? [];
  const overdue = summary?.overduePayments ?? [];

  // Period display for overdue payments table
  function periodLabel(month: number, year: number) {
    return `${MONTHS_ES[month - 1]} ${year}`;
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Centro de cobranzas</h1>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar los datos de cobranza. Verificá que el backend esté corriendo.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de cobranzas</h1>
          <p className="text-sm text-muted-foreground">
            Métricas financieras y proyecciones del negocio.
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" /> Exportar reporte
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Facturación mensual"
          value={formatMoney(summary?.monthly ?? 0)}
          icon={BadgeDollarSign}
          loading={isLoading}
        />
        <Metric
          label="Proyección anual"
          value={formatMoney(summary?.annualProjection ?? 0)}
          icon={TrendingUp}
          loading={isLoading}
          accent="bg-gradient-to-r from-transparent via-accent/70 to-transparent"
        />
        <Metric
          label="Cobrado este mes"
          value={formatMoney(summary?.collectedThisMonth ?? 0)}
          icon={Wallet}
          loading={isLoading}
          accent="bg-gradient-to-r from-transparent via-success/60 to-transparent"
        />
        <Metric
          label="Pagos pendientes"
          value={formatMoney(summary?.pending ?? 0)}
          icon={CalendarClock}
          loading={isLoading}
          accent="bg-gradient-to-r from-transparent via-warning/60 to-transparent"
        />
        <Metric
          label="Deuda total"
          value={formatMoney(summary?.debt ?? 0)}
          icon={AlertTriangle}
          loading={isLoading}
          accent="bg-gradient-to-r from-transparent via-destructive/60 to-transparent"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/60 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ingresos últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ left: -10, right: 8, top: 5 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.62 0.22 255)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.62 0.22 255)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                    <XAxis
                      dataKey="m"
                      tick={{ fill: "oklch(0.72 0.02 250)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.72 0.02 250)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "oklch(0.22 0.035 260)",
                        border: "1px solid oklch(1 0 0 / 10%)",
                        borderRadius: 8,
                        color: "white",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="oklch(0.62 0.22 255)"
                      strokeWidth={2}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Distribución de planes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dist}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {dist.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: "oklch(0.22 0.035 260)",
                        border: "1px solid oklch(1 0 0 / 10%)",
                        borderRadius: 8,
                        color: "white",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {dist.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {d.name}
                  </span>
                  <span className="text-muted-foreground">{d.value} servicios</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Cobrado vs pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pvp} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "oklch(0.72 0.02 250)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.72 0.02 250)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "oklch(0.22 0.035 260)",
                        border: "1px solid oklch(1 0 0 / 10%)",
                        borderRadius: 8,
                        color: "white",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {pvp.map((_, i) => (
                        <Cell
                          key={i}
                          fill={[CHART_COLORS[3], CHART_COLORS[2], CHART_COLORS[4]][i]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pagos vencidos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : overdue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Sin pagos vencidos
                    </TableCell>
                  </TableRow>
                ) : (
                  overdue.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.clientCompany}</TableCell>
                      <TableCell className="text-muted-foreground">{p.serviceDomain}</TableCell>
                      <TableCell>{periodLabel(p.periodMonth, p.periodYear)}</TableCell>
                      <TableCell>
                        <StatusBadge status="vencido" />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {formatMoney(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
