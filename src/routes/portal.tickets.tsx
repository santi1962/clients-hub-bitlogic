import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useTickets } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { DEMO_CLIENT_ID } from "./portal";

export const Route = createFileRoute("/portal/tickets")({
  component: PortalTickets,
});

function PortalTickets() {
  const { user } = useAuth();

  // En producción, clientes SIN clientId no pueden ver tickets
  let clientId = user?.clientId;
  let isUnauthenticated = false;

  if (!clientId) {
    // En dev: staff puede ver demo con DEMO_CLIENT_ID
    // En prod: solo clientes con clientId pueden acceder
    if (user?.role === "cliente") {
      isUnauthenticated = true;
    } else if (import.meta.env.DEV) {
      clientId = DEMO_CLIENT_ID;
    } else {
      isUnauthenticated = true;
    }
  }

  const { data: ticketsData, isLoading, isError } = useTickets({ clientId: clientId || undefined });
  const tickets = ticketsData?.data ?? [];

  if (isUnauthenticated) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={AlertTriangle}
            title="Sin acceso a tickets"
            description="Tu cuenta no está asociada a un cliente. Contactá a soporte."
          />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">Error al cargar los tickets.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Mis tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Mis tickets</CardTitle>
        <Button size="sm" asChild>
          <Link to="/portal/tickets/nuevo">
            <Plus className="h-4 w-4" /> Nuevo ticket
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {tickets.length === 0 ? (
          <EmptyState title="Sin tickets" description="No abriste ningún ticket todavía." />
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border/60 bg-background/40 p-4 hover:border-accent/50 transition cursor-pointer"
              onClick={() => (window.location.href = `/portal/tickets/${t.id}`)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border px-2 py-0 text-[10px]",
                    t.priority === "urgente" &&
                      "border-destructive/40 bg-destructive/10 text-destructive",
                    t.priority === "alta" && "border-warning/40 bg-warning/10 text-warning",
                    t.priority === "normal" && "border-muted/40",
                    t.priority === "baja" && "border-muted/40 text-muted-foreground",
                  )}
                >
                  {t.priority}
                </Badge>
                <StatusBadge status={t.status} />
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Actualizado {formatDate(t.lastMessageAt ?? t.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{t.subject}</p>
              {t.assignedUserName && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Atendido por {t.assignedUserName}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
