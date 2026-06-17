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
import { getAccessToken } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/negocio")({
  head: () => ({ meta: [{ title: "Dashboard Negocio — Bitlogic" }] }),
  component: NegocioPage,
});

interface BusinessMetrics {
  active_clients: number;
  mrr: number;
  monthly_revenue: number;
  annual_revenue: number;
  active_services: number;
  managed_domains: number;
  open_tickets: number;
  pending_tasks: number;
}

// TEMPORARY: Mock data only shown in DEV. Replace with real API data from /api/analytics/revenue and /api/analytics/clients
// TODO: Connect to real endpoints that return historical revenue and client growth
const MOCK_REVENUE_DATA = [
  { month: "Ene", revenue: 15000 },
  { month: "Feb", revenue: 18500 },
  { month: "Mar", revenue: 22000 },
  { month: "Abr", revenue: 25500 },
  { month: "May", revenue: 28000 },
  { month: "Jun", revenue: 31500 },
];

const MOCK_CLIENTS_TREND = [
  { month: "Ene", clients: 45 },
  { month: "Feb", clients: 48 },
  { month: "Mar", clients: 52 },
  { month: "Abr", clients: 55 },
  { month: "May", clients: 58 },
  { month: "Jun", clients: 62 },
];

function NegocioPage() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = getAccessToken();

  useEffect(() => {
    loadMetrics();
  }, [token]);

  async function loadMetrics() {
    try {
      setLoading(true);

      // Fetch stats from system/status endpoint
      // Expected response: { stats: { clients: number, services: number, domains: number, mrr: number, monthly_revenue: number, tickets_open: number, tasks_pending: number } }
      const res = await fetch("/api/system/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load metrics");
      const data = await res.json();

      // Calculate business metrics based on real data from services
      const activeServices = data.stats.services || 0;
      // MRR = sum of monthly_price from all ACTIVE hosting_services (NOT hardcoded amount)
      // Backend should calculate: SELECT SUM(monthly_price) FROM hosting_services WHERE status='activo'
      const mrr = data.stats.mrr || data.stats.monthly_revenue || 0;

      setMetrics({
        active_clients: data.stats.clients || 0,
        mrr: mrr,
        monthly_revenue: mrr,
        annual_revenue: mrr * 12,
        active_services: activeServices,
        managed_domains: data.stats.domains || 0,
        open_tickets: data.stats.tickets_open || 0,
        pending_tasks: data.stats.tasks_pending || 0,
      });
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
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
        <p className="text-muted-foreground mt-2">
          Resumen de métricas clave del negocio
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Clientes Activos */}
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

        {/* MRR */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(metrics.mrr / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ingresos mensuales recurrentes</p>
          </CardContent>
        </Card>

        {/* Facturación Mensual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturación Mensual</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(metrics.monthly_revenue / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground mt-1">Proyectado este mes</p>
          </CardContent>
        </Card>

        {/* Facturación Anual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyección Anual</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${(metrics.annual_revenue / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimada para este año</p>
          </CardContent>
        </Card>
      </div>

      {/* Operacional */}
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia de Facturación</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={MOCK_REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Clients Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crecimiento de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={MOCK_CLIENTS_TREND}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clients" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Health Status */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>PostgreSQL</span>
            <Badge className="bg-green-600">OK</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>SMTP</span>
            <Badge className="bg-green-600">Configurado</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>HestiaCP</span>
            <Badge className="bg-green-600">Configurado</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Scheduler</span>
            <Badge className="bg-green-600">Activo</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
