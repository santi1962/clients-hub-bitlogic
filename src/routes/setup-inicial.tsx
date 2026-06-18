import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Building2,
  Package,
  Users,
  Server,
  Globe,
  LogIn,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { SetupCompany } from "@/components/setup/setup-company";
import { SetupPlans } from "@/components/setup/setup-plans";
import { SetupClients } from "@/components/setup/setup-clients";
import { SetupServices } from "@/components/setup/setup-services";
import { SetupDomains } from "@/components/setup/setup-domains";
import { SetupUsers } from "@/components/setup/setup-users";
import { SetupReadiness } from "@/components/setup/setup-readiness";

export const Route = createFileRoute("/setup-inicial")({
  head: () => ({
    meta: [{ title: "Setup Inicial — Bitlogic Client Hub" }],
  }),
  component: SetupInicial,
});

function SetupInicial() {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkReadiness = async () => {
      try {
        const res = await fetch("/api/settings/readiness");
        const data = await res.json();
        setReadiness(data);
      } catch (err) {
        console.error("Error checking readiness:", err);
      } finally {
        setLoading(false);
      }
    };

    checkReadiness();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Setup Inicial — Bitlogic</h1>
          <p className="text-muted-foreground">
            Configura los datos necesarios antes de poner el sistema en producción.
          </p>
        </div>

        {/* Readiness Alert */}
        {readiness && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-4 ${
              readiness.ready
                ? "border-green-500/30 bg-green-500/10 text-green-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700"
            }`}
          >
            {readiness.ready ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              {readiness.ready ? (
                <div>
                  <p className="font-medium">✅ Sistema listo para producción</p>
                  <p className="text-sm opacity-90">
                    Todos los requisitos han sido cumplidos.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">⚠️ Sistema no está completamente configurado</p>
                  <p className="text-sm opacity-90">
                    Falta completar: {readiness.warnings.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="empresa" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 gap-1">
            <TabsTrigger value="empresa" className="flex flex-col gap-1 text-xs">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="planes" className="flex flex-col gap-1 text-xs">
              <Package className="h-4 w-4" />
              Planes
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex flex-col gap-1 text-xs">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="servicios" className="flex flex-col gap-1 text-xs">
              <Server className="h-4 w-4" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="dominios" className="flex flex-col gap-1 text-xs">
              <Globe className="h-4 w-4" />
              Dominios
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex flex-col gap-1 text-xs">
              <LogIn className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="verificacion" className="flex flex-col gap-1 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              Estado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">
            <SetupCompany />
          </TabsContent>

          <TabsContent value="planes">
            <SetupPlans />
          </TabsContent>

          <TabsContent value="clientes">
            <SetupClients />
          </TabsContent>

          <TabsContent value="servicios">
            <SetupServices />
          </TabsContent>

          <TabsContent value="dominios">
            <SetupDomains />
          </TabsContent>

          <TabsContent value="usuarios">
            <SetupUsers />
          </TabsContent>

          <TabsContent value="verificacion">
            <SetupReadiness readiness={readiness} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-12 rounded-lg border border-border/60 bg-card/60 p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Importante:</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>No inventes datos. Usa información real de tu empresa.</li>
                <li>Los precios deben ser reales y editables en cualquier momento.</li>
                <li>Los clientes, servicios y dominios deben coincidir con tus registros.</li>
                <li>Completa primero Empresa y Planes, luego Clientes, Servicios y Dominios.</li>
                <li>
                  Crea usuarios del portal solo para clientes que accedan a él realmente.
                </li>
                <li>Una vez configurado, puedes cambiar cualquier dato en la sección correspondiente.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
