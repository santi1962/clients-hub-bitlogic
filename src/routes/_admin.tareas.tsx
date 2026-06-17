import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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
import {
  Plus,
  ListChecks,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/mock-data";
import { useTasks, useCompleteTask, useDeleteTask } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/tareas")({
  head: () => ({ meta: [{ title: "Tareas — Bitlogic" }] }),
  component: TareasPage,
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

function TareasPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [priority, setPriority] = useState("todos");

  const { data: tasksData, isLoading } = useTasks({
    status: status === "todos" ? undefined : status,
    priority: priority === "todos" ? undefined : priority,
    search: search || undefined,
  });

  const tasks = tasksData?.data ?? [];
  const pendingCount = (tasksData?.data ?? []).filter((t) => t.status === "pendiente").length;
  const inProgressCount = (tasksData?.data ?? []).filter((t) => t.status === "en_proceso").length;
  const urgentCount = (tasksData?.data ?? []).filter((t) => t.priority === "urgente").length;
  const completedCount = (tasksData?.data ?? []).filter((t) => t.status === "completada").length;

  const completeTaskMutation = useCompleteTask("");
  const deleteTaskMutation = useDeleteTask();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tareas internas</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de tareas operativas y seguimiento.
          </p>
        </div>
        <Button asChild>
          <Link to="/tareas/nueva">
            <Plus className="h-4 w-4" /> Nueva tarea
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Pendientes"
          value={pendingCount}
          icon={ListChecks}
          color="bg-info/15 text-info"
        />
        <Kpi
          label="En proceso"
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
          label="Completadas"
          value={completedCount}
          icon={CheckCircle2}
          color="bg-success/15 text-success"
        />
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
          <CardTitle className="text-base">Lista de tareas</CardTitle>
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
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 w-[130px]">
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
          ) : tasks.length === 0 ? (
            <EmptyState
              title="Sin tareas"
              description="No hay tareas que coincidan con los filtros."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id} className={t.status === "completada" ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={t.status === "completada"}
                        disabled={t.status === "cancelada"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
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
                    <TableCell className="text-sm">{t.assignedUserName ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.clientCompany ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/tareas/$id" params={{ id: t.id }}>
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
