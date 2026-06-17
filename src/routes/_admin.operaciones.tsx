// ============================================================
// CENTRO DE OPERACIONES — Command Center
// ------------------------------------------------------------
// Vista unificada para el equipo operativo.
// Backend futuro: endpoint agregado /api/ops/summary que combine
// los conteos en una sola query (más eficiente que N llamadas).
// ============================================================

import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, LifeBuoy, Globe, Wallet, Server, ListChecks, ArrowRight } from "lucide-react";
import {
  services,
  payments,
  getClient,
  getPlan,
  formatDate,
  formatMoney,
  daysUntil,
  isWithinNextDays,
} from "@/lib/mock-data";
import { tickets, domains, tasks, priorityColor, priorityLabel } from "@/lib/mock-data-extra";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/activity-timeline";

export const Route = createFileRoute("/_admin/operaciones")({
  head: () => ({ meta: [{ title: "Centro de Operaciones — Bitlogic" }] }),
  component: OperacionesPage,
});

function SectionCard({
  title,
  icon: Icon,
  count,
  to,
  color,
  children,
}: {
  title: string;
  icon: any;
  count: number;
  to: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", color)}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
          <Badge
            variant="outline"
            className="ml-1 rounded-full bg-background/40 border-border/60 text-[10px]"
          >
            {count}
          </Badge>
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to={to as any}>
            Ver todo <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function OperacionesPage() {
  const openTickets = tickets
    .filter(
      (t) =>
        t.status === "abierto" || t.status === "en_proceso" || t.status === "esperando_cliente",
    )
    .slice(0, 5);
  const domainsDueSoon = domains
    .filter((d) => d.status !== "transferido")
    .filter((d) => {
      const diff = daysUntil(d.expiresAt);
      return diff >= -30 && diff <= 30;
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    .slice(0, 5);
  const pendingPays = payments
    .filter((p) => p.status === "pendiente" || p.status === "vencido")
    .slice(0, 5);
  const upcomingSvc = services
    .filter((s) => s.status !== "cancelado" && s.status !== "suspendido")
    .filter((s) => isWithinNextDays(s.nextDueDate, 14))
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 5);
  const pendingTasks = tasks
    .filter((t) => t.status === "pendiente" || t.status === "en_proceso")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Command className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de Operaciones</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que requiere atención hoy, en una sola pantalla.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Tickets abiertos"
          icon={LifeBuoy}
          count={openTickets.length}
          to="/soporte"
          color="bg-info/15 text-info"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prio.</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {t.number}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">{t.subject}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getClient(t.clientId)?.company}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2 py-0 text-[10px]",
                        priorityColor[t.priority],
                      )}
                    >
                      {priorityLabel[t.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Dominios por vencer"
          icon={Globe}
          count={domainsDueSoon.length}
          to="/dominios"
          color="bg-warning/15 text-warning"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dominio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domainsDueSoon.map((d) => {
                const diff = daysUntil(d.expiresAt);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClient(d.clientId)?.company}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatDate(d.expiresAt)}</span>
                        <span
                          className={
                            "text-[11px] " + (diff < 0 ? "text-destructive" : "text-warning")
                          }
                        >
                          {diff < 0 ? `${Math.abs(diff)}d venc.` : `en ${diff}d`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Pagos pendientes"
          icon={Wallet}
          count={pendingPays.length}
          to="/pagos"
          color="bg-accent/15 text-accent"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPays.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{getClient(p.clientId)?.company}</TableCell>
                  <TableCell className="text-muted-foreground">{p.periodMonth}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Servicios por vencer"
          icon={Server}
          count={upcomingSvc.length}
          to="/servicios"
          color="bg-primary/15 text-primary"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dominio</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingSvc.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.domain}</TableCell>
                  <TableCell>{getPlan(s.planId)?.name}</TableCell>
                  <TableCell>{formatDate(s.nextDueDate)}</TableCell>
                  <TableCell className="text-right">{formatMoney(s.monthlyPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Tareas pendientes"
          icon={ListChecks}
          count={pendingTasks.length}
          to="/tareas"
          color="bg-success/15 text-success"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-[260px] truncate font-medium">{t.title}</TableCell>
                  <TableCell className="text-muted-foreground">{t.assignee}</TableCell>
                  <TableCell>{formatDate(t.dueDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      <ActivityTimeline title="Actividad reciente de toda la operación" limit={15} />
    </div>
  );
}
