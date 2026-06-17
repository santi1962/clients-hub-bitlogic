import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { getAccessToken } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico — Bitlogic" }] }),
  component: DiagnosticoPage,
});

interface SystemStatus {
  version: string;
  uptime: number;
  timestamp: string;
  database: string;
  smtp: string;
  hestia: string;
  scheduler: string;
  stats: {
    clients: number;
    services: number;
    domains: number;
    tickets_open: number;
    tasks_pending: number;
  };
}

type StatusLevel = "ok" | "configured" | "unconfigured" | "active" | "idle" | "unknown" | "error";

function getStatusColor(status: StatusLevel): string {
  switch (status) {
    case "ok":
    case "active":
    case "configured":
      return "bg-green-100 text-green-800 border-green-300";
    case "idle":
    case "unconfigured":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "error":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function getStatusIcon(status: StatusLevel): React.ReactNode {
  switch (status) {
    case "ok":
    case "active":
    case "configured":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "idle":
    case "unconfigured":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
}

function getStatusLabel(status: StatusLevel): string {
  switch (status) {
    case "ok":
      return "OK";
    case "active":
      return "Activo";
    case "configured":
      return "Configurado";
    case "idle":
      return "Inactivo";
    case "unconfigured":
      return "Sin configurar";
    case "error":
      return "Error";
    default:
      return "Desconocido";
  }
}

function DiagnosticoPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = getAccessToken();

  useEffect(() => {
    loadStatus();
  }, [token]);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/system/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load system status");
      const data = await res.json();
      setStatus(data);
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

  if (error || !status) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Diagnóstico del Sistema</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Error al cargar diagnóstico</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Diagnóstico del Sistema</h1>
        <p className="text-muted-foreground mt-2">
          Estado actual de los componentes de Bitlogic Client Hub
        </p>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">PostgreSQL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(status.database as StatusLevel)}
              <Badge
                variant="outline"
                className={`${getStatusColor(status.database as StatusLevel)}`}
              >
                {getStatusLabel(status.database as StatusLevel)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Base de datos</p>
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">SMTP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(status.smtp as StatusLevel)}
              <Badge
                variant="outline"
                className={`${getStatusColor(status.smtp as StatusLevel)}`}
              >
                {getStatusLabel(status.smtp as StatusLevel)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Email</p>
          </CardContent>
        </Card>

        {/* Hestia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">HestiaCP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(status.hestia as StatusLevel)}
              <Badge
                variant="outline"
                className={`${getStatusColor(status.hestia as StatusLevel)}`}
              >
                {getStatusLabel(status.hestia as StatusLevel)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Hosting API</p>
          </CardContent>
        </Card>

        {/* Scheduler */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Scheduler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(status.scheduler as StatusLevel)}
              <Badge
                variant="outline"
                className={`${getStatusColor(status.scheduler as StatusLevel)}`}
              >
                {getStatusLabel(status.scheduler as StatusLevel)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Jobs automáticos</p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Math.floor(status.uptime / 3600)}h
            </p>
            <p className="text-xs text-muted-foreground">
              {Math.floor((status.uptime % 3600) / 60)}m
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Estadísticas del Sistema</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Clientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.stats.clients}</div>
              <p className="text-xs text-muted-foreground mt-1">Status = active</p>
            </CardContent>
          </Card>

          {/* Servicios */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.stats.services}</div>
              <p className="text-xs text-muted-foreground mt-1">
                active, due_soon, pending_payment
              </p>
            </CardContent>
          </Card>

          {/* Dominios */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dominios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.stats.domains}</div>
              <p className="text-xs text-muted-foreground mt-1">activo, proximo_a_vencer</p>
            </CardContent>
          </Card>

          {/* Tickets Abiertos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Abiertos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.stats.tickets_open}</div>
              <p className="text-xs text-muted-foreground mt-1">open, waiting_customer</p>
            </CardContent>
          </Card>

          {/* Tareas Pendientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tareas Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{status.stats.tasks_pending}</div>
              <p className="text-xs text-muted-foreground mt-1">pending, in_progress</p>
            </CardContent>
          </Card>

          {/* Version */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Versión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{status.version}</div>
              <p className="text-xs text-muted-foreground mt-1">Backend</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-muted-foreground">
        Última actualización: {new Date(status.timestamp).toLocaleString("es-AR")}
      </div>
    </div>
  );
}
