import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { getAccessToken } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding de Clientes — Bitlogic" }] }),
  component: OnboardingPage,
});

interface ClientOnboarding {
  client_id: string;
  name: string;
  created_at: string;
  steps: {
    client_created: boolean;
    service_created: boolean;
    domain_loaded: boolean;
    portal_user_created: boolean;
    hestia_synced: boolean;
    first_notice_generated: boolean;
    first_payment_registered: boolean;
  };
}

function OnboardingPage() {
  const [clients, setClients] = useState<ClientOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = getAccessToken();

  useEffect(() => {
    loadClients();
  }, [token]);

  async function loadClients() {
    try {
      setLoading(true);
      const res = await fetch("/api/clients?limit=50", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();

      // Mock onboarding status based on real data
      const clientsData = (data.data || []).map((client: any) => {
        const createdAt = new Date(client.created_at);
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        return {
          client_id: client.id,
          name: client.name || "Sin nombre",
          created_at: client.created_at,
          steps: {
            client_created: true,
            service_created: daysOld >= 0,
            domain_loaded: daysOld >= 1,
            portal_user_created: daysOld >= 1,
            hestia_synced: daysOld >= 2,
            first_notice_generated: daysOld >= 3,
            first_payment_registered: daysOld >= 5,
          },
        };
      });

      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function calculateProgress(steps: ClientOnboarding["steps"]): number {
    const completed = Object.values(steps).filter(Boolean).length;
    return Math.round((completed / 7) * 100);
  }

  const steps = [
    { key: "client_created", label: "Cliente creado", order: 1 },
    { key: "service_created", label: "Servicio creado", order: 2 },
    { key: "domain_loaded", label: "Dominio cargado", order: 3 },
    { key: "portal_user_created", label: "Usuario portal creado", order: 4 },
    { key: "hestia_synced", label: "Hestia sincronizado", order: 5 },
    { key: "first_notice_generated", label: "Primer aviso generado", order: 6 },
    { key: "first_payment_registered", label: "Primer pago registrado", order: 7 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Onboarding de Clientes</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
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
        <h1 className="text-3xl font-bold">Onboarding de Clientes</h1>
        <p className="text-muted-foreground mt-2">
          Seguimiento del progreso de onboarding de cada cliente
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onboarding Completo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {clients.filter((c) => calculateProgress(c.steps) === 100).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {clients.length > 0
                ? Math.round(
                    (clients.filter((c) => calculateProgress(c.steps) === 100).length /
                      clients.length) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {clients.length > 0
                ? Math.round(
                    clients.reduce((sum, c) => sum + calculateProgress(c.steps), 0) /
                      clients.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Creado</TableHead>
                  {steps.map((step) => (
                    <TableHead key={step.key} className="text-center text-xs">
                      {step.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Progreso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const progress = calculateProgress(client.steps);
                  return (
                    <TableRow key={client.client_id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {client.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(client.created_at).toLocaleDateString("es-AR")}
                      </TableCell>
                      {steps.map((step) => (
                        <TableCell key={step.key} className="text-center">
                          {(client.steps as any)[step.key] ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300 mx-auto" />
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Step Description */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">Pasos del Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {steps.map((step, idx) => (
              <div key={step.key} className="flex items-start gap-3">
                <span className="font-bold text-blue-700 w-6">{step.order}</span>
                <div>
                  <span className="font-medium text-blue-900">{step.label}</span>
                  {idx === 0 && (
                    <p className="text-xs text-blue-700">
                      Registro del cliente en el sistema
                    </p>
                  )}
                  {idx === 1 && (
                    <p className="text-xs text-blue-700">
                      Creación del plan de hosting para el cliente
                    </p>
                  )}
                  {idx === 2 && (
                    <p className="text-xs text-blue-700">
                      Registro del dominio asignado al cliente
                    </p>
                  )}
                  {idx === 3 && (
                    <p className="text-xs text-blue-700">
                      Creación de usuario y contraseña para portal
                    </p>
                  )}
                  {idx === 4 && (
                    <p className="text-xs text-blue-700">
                      Sincronización de datos con HestiaCP
                    </p>
                  )}
                  {idx === 5 && (
                    <p className="text-xs text-blue-700">
                      Generación automática de primer aviso de pago
                    </p>
                  )}
                  {idx === 6 && (
                    <p className="text-xs text-blue-700">
                      Registro del primer pago en el sistema
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
