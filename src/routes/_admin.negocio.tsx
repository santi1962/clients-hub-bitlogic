import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, DollarSign, Globe } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { request, getAccessToken } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/negocio")({
  head: () => ({ meta: [{ title: "Dashboard Negocio — Bitlogic" }] }),
  component: NegocioPage,
});

interface BusinessMetrics {
  active_clients: number;
  mrr: number;
  active_services: number;
  managed_domains: number;
  open_tickets: number;
  pending_tasks: number;
}

interface SystemStatus {
  database: string;
  smtp: string;
  hestia: string;
  scheduler: string;
}

interface TrendPoint {
  month: string;
  revenue?: number;
  clients?: number;
}

function statusBadge(val: string) {
  const ok = val === "ok" || val === "configured" || val === "active";
  const warn = val === "unconfigured" || val === "idle";
  return (
    <Badge className={ok ? "bg-green-600" : warn ? "bg-amber-500" : "bg-red-600"}>
      {val === "ok" ? "OK"
        : val === "configured" ? "Configurado"
        : val === "unconfigured" ? "Sin configurar"
        : val === "active" ? "Activo"
        : val === "idle" ? "Inactivo"
        : val === "error" ? "Error"
        : val}
    </Badge>
  );
}

function NegocioPage() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<TrendPoint[]>([]);
  const [clientTrend, setClientTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = getAccessToken();

  useEffect(() => {
    loadAll();
  }, [token]);

  async function loadAll() {
    try {
      setLoading(true);

      const [statusData, dashData, analyticsData] = await Promise.all([
        request<SystemStatus>("/system/status"),
        request<{
          activeClients: number;
          activeServices: number;
          monthlyRevenue: number;
          activeDomainsCount: number;
          openTicketsCount: number;
          pendingTasksCount: number;
        }>("/dashboard/admin"),
        request<{ revenue_trend: TrendPoint[]; client_trend: TrendPoint[] }>(
          "/dashboard/analytics"
        ),
      ]);

      setSystemStatus({
        database: statusData.database,
        smtp: statusData.smtp,
        hestia: statusData.hestia,
        scheduler: statusData.scheduler,
      });

      setMetrics({
        active_clients: dashData.activeClients || 0,
        mrr: dashData.monthlyRevenue || 0,
        active_services: dashData.activeServices || 0,
        managed_domains: dashData.activeDomainsCount || 0,
        open_tickets: dashData.openTicketsCount || 0,
        pending_tasks: dashData.pendingTasksCount || 0,
      });

      setRevenueTrend(analyticsData.revenue_trend);
      setClientTrend(analyticsData.client_trend);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mrr = metrics.mrr;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
        <p className="text-muted-foreground mt-2">Resumen de métricas clave del negocio</p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.active_clients}</div>
            <p className="text-xs text-muted-foreground mt-1">Clientes en sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${mrr >= 1000 ? `${(mrr / 1000).toFixed(1)}K` : mrr.toLocaleString("es-AR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos mensuales recurrentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturación Mensual</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${mrr >= 1000 ? `${(mrr / 1000).toFixed(1)}K` : mrr.toLocaleString("es-AR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Proyectado este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Anual</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(mrr * 12) >= 1000 ? `${((mrr * 12) / 1000).toFixed(0)}K` : (mrr * 12).toLocaleString("es-AR")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimada para este año</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs operacionales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.active_services}</div>
            <p className="text-xs text-muted-foreground mt-1">Planes de hosting en uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dominios</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.managed_domains}</div>
            <p className="text-xs text-muted-foreground mt-1">Bajo administración</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abiertos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{metrics.open_tickets}</div>
            <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tareas Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.pending_tasks}</div>
            <p className="text-xs text-muted-foreground mt-1">En el backlog</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos con datos reales */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facturación mensual (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin pagos registrados aún</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString("es-AR")}`, "Facturado"]} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes activos por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {clientTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos aún</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clientTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [value, "Clientes"]} />
                  <Bar dataKey="clients" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado del sistema — dinámico */}
      {systemStatus && (
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>PostgreSQL</span>
              {statusBadge(systemStatus.database)}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>SMTP</span>
              {statusBadge(systemStatus.smtp)}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>HestiaCP</span>
              {statusBadge(systemStatus.hestia)}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Scheduler</span>
              {statusBadge(systemStatus.scheduler)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
