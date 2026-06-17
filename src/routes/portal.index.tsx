import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ExternalLink, ArrowUpRight, AlertTriangle } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/mock-data";
import { useAuthUser } from "@/lib/auth";
import { useClient, useClientServices, usePlans } from "@/lib/queries";

export const Route = createFileRoute("/portal/")({
  component: PortalServicios,
});

function PortalServicios() {
  const user = useAuthUser();
  const clientId = user.clientId;

  const { data: clientData, isLoading: clientLoading } = useClient(clientId);
  const client = clientData;

  const { data: servicesData, isLoading: servicesLoading } = useClientServices(clientId);
  const services = servicesData?.data ?? [];

  const { data: plansData } = usePlans();
  const plans = plansData?.data ?? [];

  const totalDue = services.reduce((acc, s) => acc + s.monthlyPrice, 0);

  if (!client && (clientLoading || servicesLoading)) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-64 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <EmptyState
        title="Error cargando datos"
        description="No pudimos cargar tu información. Verificá tu conexión e intentá nuevamente."
      />
    );
  }

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-primary/20 via-card to-card">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
        <CardContent className="relative grid gap-6 p-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent">
              Hola, {client.name.split(" ")[0]}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tu hosting con Bitlogic</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gestioná tus servicios, dominios, pagos y tickets desde un solo lugar.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/portal/pagos">
                  <CreditCard className="h-4 w-4" /> Pagar ahora
                </Link>
              </Button>
              <Button variant="outline">
                <ArrowUpRight className="h-4 w-4" /> Solicitar upgrade
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
              <p className="text-[11px] uppercase text-muted-foreground">Servicios</p>
              <p className="mt-1 text-2xl font-semibold">
                {servicesLoading ? "—" : services.length}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
              <p className="text-[11px] uppercase text-muted-foreground">Próx. venc.</p>
              <p className="mt-1 text-sm font-semibold">
                {servicesLoading
                  ? "—"
                  : services.length > 0
                    ? formatDate(services.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0].nextDueDate)
                    : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/60 p-4">
              <p className="text-[11px] uppercase text-muted-foreground">A pagar</p>
              <p className="mt-1 text-2xl font-semibold text-accent">
                {servicesLoading ? "—" : formatMoney(totalDue)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Mis servicios</h2>
        {servicesLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            title="Sin servicios"
            description="No tenés servicios activos. Contactá a soporte para contratar."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((s) => {
              const plan = plans.find((p) => p.id === s.planId);
              const storageGB = plan?.storageGB ?? 0;
              const pct = storageGB > 0 ? Math.min(100, Math.round((s.usedGB / storageGB) * 100)) : 0;
              return (
                <Card key={s.id} className="border-border/60 bg-card/60">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">{s.domain}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">Plan {plan?.name ?? "—"}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Espacio usado</span>
                        <span>
                          {s.usedGB} / {storageGB} GB
                        </span>
                      </div>
                      <Progress value={pct} className="mt-1.5 h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Próximo pago</p>
                        <p className="font-medium">{formatDate(s.nextDueDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monto</p>
                        <p className="font-medium">{formatMoney(s.monthlyPrice)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" asChild>
                        <Link to="/portal/pagos">
                          <CreditCard className="h-4 w-4" /> Pagar
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={s.hestiaUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" /> Entrar a Hestia
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost">
                        <ArrowUpRight className="h-4 w-4" /> Upgrade
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
