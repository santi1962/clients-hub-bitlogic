import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LifeBuoy, AlertTriangle, Clock, CheckCircle2, Plus, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/mock-data";
import { useTickets } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/soporte")({
  head: () => ({ meta: [{ title: "Soporte — Bitlogic" }] }),
  component: SoportePage,
});

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function SoportePage() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("todos");
  const [status, setStatus] = useState("todos");

  const { data: ticketsData, isLoading } = useTickets({
    priority: priority === "todos" ? undefined : priority,
    status: status === "todos" ? undefined : status,
    search: search || undefined,
  });

  const tickets = ticketsData?.data ?? [];
  const openCount = (ticketsData?.data ?? []).filter((t) => t.status === "abierto").length;
  const inProgressCount = (ticketsData?.data ?? []).filter(
    (t) => t.status === "en_progreso",
  ).length;
  const urgentCount = (ticketsData?.data ?? []).filter((t) => t.priority === "urgente").length;
  const resolvedCount = (ticketsData?.data ?? []).filter((t) => t.status === "resuelto").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Soporte</h1>
          <p className="text-sm text-muted-foreground">Helpdesk: gestión de tickets de clientes.</p>
        </div>
        <Button asChild>
          <Link to="/soporte/nuevo">
            <Plus className="h-4 w-4" /> Nuevo ticket
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Abiertos" value={openCount} icon={LifeBuoy} color="bg-info/15 text-info" />
        <Kpi
          label="En progreso"
          value={inProgressCount}
          icon={Clock}
          color="bg-accent/15 text-accent"
        />
        <Kpi
          label="Urgentes"
          value={urgentCount}
          icon={AlertTriangle}
          color="bg-destructive/15 text-destructive"
        />
        <Kpi
          label="Resueltos"
          value={resolvedCount}
          icon={CheckCircle2}
          color="bg-success/15 text-success"
        />
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <CardTitle className="text-base">Cola de tickets</CardTitle>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="h-9 w-[200px] pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos estados</SelectItem>
                <SelectItem value="abierto">Abierto</SelectItem>
                <SelectItem value="en_progreso">En progreso</SelectItem>
                <SelectItem value="esperando_cliente">Esperando cliente</SelectItem>
                <SelectItem value="resuelto">Resuelto</SelectItem>
                <SelectItem value="cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda prioridad</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="Sin tickets"
              description="No hay tickets que coincidan con los filtros."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.ticketNumber}</TableCell>
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell className="text-sm">{t.clientCompany ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          t.priority === "urgente" &&
                            "border-destructive/40 bg-destructive/10 text-destructive",
                          t.priority === "alta" && "border-warning/40 bg-warning/10 text-warning",
                          t.priority === "normal" && "border-muted/40",
                          t.priority === "baja" && "border-muted/40 text-muted-foreground",
                        )}
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-sm">{t.assignedUserName ?? "Sin asignar"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.lastMessageAt ? formatDate(t.lastMessageAt) : formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/soporte/$id" params={{ id: t.id }}>
                          Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
