import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  AlertTriangle,
  LifeBuoy,
  CalendarClock,
  Users,
  Server,
  Wallet,
  FileText,
  Globe,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useDashboard } from "@/lib/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_admin/bienvenida")({
  head: () => ({ meta: [{ title: "Bienvenida — Bitlogic Client Portal" }] }),
  component: Welcome,
});

function Welcome() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const upcoming = [...(data?.upcomingServices ?? []), ...(data?.upcomingDomains ?? [])]
    .slice(0, 5);
  const urgentTickets = (data?.recentTickets ?? []).filter((t) => t.priority === "urgent").slice(0, 5);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Hero */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Bitlogic Client Portal
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {greet}, {user?.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sistema limpio, listo para comenzar.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/">
              Ir al Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Resumen del día */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumen del día</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <>
                <Row icon={Users} label="Clientes activos" value={String(data?.activeClients ?? 0)} />
                <Row icon={Server} label="Servicios activos" value={String(data?.activeServices ?? 0)} />
                <Row icon={Wallet} label="Cobrado este mes" value={formatMoney(data?.collectedThisMonth ?? 0)} />
                <Row icon={FileText} label="Avisos vencidos" value={String(data?.overdueNoticesCount ?? 0)} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Vencimientos */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-warning" /> Vencimientos importantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : upcoming.length === 0 ? (
              <p className="text-muted-foreground">Sin vencimientos próximos</p>
            ) : (
              upcoming.map((item) => {
                const date = (item as any).nextDueDate ?? (item as any).expirationDate;
                const diff = Math.round((new Date(date).getTime() - Date.now()) / 86400000);
                const kind = (item as any).planName ? "Servicio" : "Dominio";
                return <DueRow key={(item as any).id} domain={(item as any).domain} days={diff} kind={kind} />;
              })
            )}
          </CardContent>
        </Card>

        {/* Tickets urgentes */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-destructive" /> Tickets urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : urgentTickets.length === 0 ? (
              <p className="text-muted-foreground">Sin tickets urgentes</p>
            ) : (
              urgentTickets.map((t) => (
                <TicketRow key={t.id} id={t.ticketNumber ?? t.id} subject={t.subject} client={t.clientCompany} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acciones recomendadas */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Acciones recomendadas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Action
            to="/workflows"
            icon={Sparkles}
            title="Alta de cliente"
            desc="Onboarding guiado en 4 pasos"
          />
          <Action
            to="/avisos"
            icon={FileText}
            title="Generar aviso"
            desc="Crear aviso de vencimiento"
          />
          <Action
            to="/cobranza"
            icon={Wallet}
            title="Revisar cobranza"
            desc="Pagos pendientes del mes"
          />
          <Action to="/tareas" icon={ListChecks} title="Tareas pendientes" desc="0 sin asignar" />
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <QuickLink to="/clientes" icon={Users}>
            Clientes
          </QuickLink>
          <QuickLink to="/servicios" icon={Server}>
            Servicios
          </QuickLink>
          <QuickLink to="/dominios" icon={Globe}>
            Dominios
          </QuickLink>
          <QuickLink to="/pagos" icon={Wallet}>
            Pagos
          </QuickLink>
          <QuickLink to="/soporte" icon={LifeBuoy}>
            Soporte
          </QuickLink>
          <QuickLink to="/configuracion" icon={ListChecks}>
            Configuración
          </QuickLink>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function DueRow({ domain, days, kind }: { domain: string; days: number; kind: string }) {
  const tone =
    days <= 3 ? "text-destructive" : days <= 7 ? "text-warning" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{domain}</p>
        <p className="text-[10px] text-muted-foreground">{kind}</p>
      </div>
      <Badge variant="outline" className={"text-[10px] " + tone}>
        {days}d
      </Badge>
    </div>
  );
}

function TicketRow({ id, subject, client }: { id: string; subject: string; client: string }) {
  return (
    <Link
      to="/soporte"
      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{subject}</p>
        <p className="text-[10px] text-muted-foreground">{client}</p>
      </div>
      <Badge variant="outline" className="text-[10px]">
        #{id}
      </Badge>
    </Link>
  );
}

function Action({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as any}
      className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3 hover:border-primary/40 hover:bg-primary/[0.04] transition"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}

function QuickLink({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <Link to={to as any}>
        <Icon className="h-3.5 w-3.5" /> {children}
      </Link>
    </Button>
  );
}
