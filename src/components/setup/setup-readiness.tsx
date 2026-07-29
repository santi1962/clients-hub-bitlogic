import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, RotateCw } from "lucide-react";
import { request } from "@/lib/api-client";

interface ReadinessData {
  ready: boolean;
  checks: {
    companyConfigured: boolean;
    activePlansExist: boolean;
    realClientsExist: boolean;
    realServicesExist: boolean;
    domainsExist: boolean;
    portalUsersExist: boolean;
    smtpConfigured: boolean;
    hestiaConfigured: boolean;
  };
  completed?: number;
  total?: number;
  percentage?: number;
  warnings: string[];
}

interface ReadinessProps {
  readiness: ReadinessData | null;
}

const checkLabels: Record<string, string> = {
  companyConfigured: "Empresa configurada",
  activePlansExist: "Al menos 1 plan activo",
  realClientsExist: "Al menos 1 cliente real",
  realServicesExist: "Al menos 1 servicio real",
  domainsExist: "Al menos 1 dominio cargado",
  portalUsersExist: "Al menos 1 usuario portal",
  smtpConfigured: "SMTP configurado",
  hestiaConfigured: "Hestia integrada",
};

export function SetupReadiness({ readiness: initialReadiness }: ReadinessProps) {
  const [readiness, setReadiness] = useState<ReadinessData | null>(initialReadiness);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await request<ReadinessData>("/settings/readiness");
      setReadiness(data);
    } catch (err) {
      console.error("Error refreshing readiness:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (!readiness) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  const percentage = readiness.percentage || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Estado de Configuración</CardTitle>
            <CardDescription>
              Verificación de requisitos para producción. Completa todos los ítems.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Summary */}
        <div
          className={`rounded-lg border-2 p-6 text-center ${
            readiness.ready
              ? "border-green-500/30 bg-green-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {readiness.ready ? (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h3 className="mt-4 text-lg font-bold text-green-700">
                ✅ Sistema listo para producción
              </h3>
              <p className="mt-2 text-sm text-green-600">
                Todos los requisitos han sido completados.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
              <h3 className="mt-4 text-lg font-bold text-amber-700">
                Progreso: {percentage}% ({readiness.completed}/{readiness.total})
              </h3>
              <div className="mt-3 h-2 w-full rounded-full bg-amber-200">
                <div
                  className="h-full rounded-full bg-amber-600 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-amber-600">
                Faltan {readiness.warnings.length} requisito(s)
              </p>
            </>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-3">
          <h4 className="font-semibold">Requisitos ({readiness.completed}/{readiness.total}):</h4>
          <div className="space-y-2">
            {Object.entries(readiness.checks).map(([key, checked]) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-3"
              >
                {checked ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                )}
                <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                  {checkLabels[key] || key}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {!readiness.ready && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Próximos pasos:</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              {readiness.warnings.includes("companyConfigured") && (
                <li>Completa la configuración de tu empresa (Sección: Empresa)</li>
              )}
              {readiness.warnings.includes("activePlansExist") && (
                <li>Crea al menos un plan de hosting activo (Sección: Planes)</li>
              )}
              {readiness.warnings.includes("realClientsExist") && (
                <li>Agrega al menos un cliente real (Sección: Clientes)</li>
              )}
              {readiness.warnings.includes("realServicesExist") && (
                <li>Crea al menos un servicio de hosting real (Sección: Servicios)</li>
              )}
              {readiness.warnings.includes("domainsExist") && (
                <li>Registra al menos un dominio (Sección: Dominios)</li>
              )}
              {readiness.warnings.includes("portalUsersExist") && (
                <li>Crea al menos un usuario del portal (Sección: Usuarios)</li>
              )}
              {readiness.warnings.includes("smtpConfigured") && (
                <li>Configura SMTP en las variables de entorno (.env)</li>
              )}
              {readiness.warnings.includes("hestiaConfigured") && (
                <li>Configura Hestia en las variables de entorno (.env)</li>
              )}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
