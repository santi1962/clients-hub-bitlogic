import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useTask, useUpdateTask, useDeleteTask } from "@/lib/queries";
import { taskStatusToDb } from "@/lib/api-mappers";

export const Route = createFileRoute("/_admin/tareas/$id")({
  head: () => ({ meta: [{ title: "Tarea — Bitlogic" }] }),
  component: TaskDetail,
  notFoundComponent: () => <div className="p-8">Tarea no encontrada.</div>,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const { data: task, isLoading, isError } = useTask(id);
  const navigate = useNavigate();
  const updateTaskMutation = useUpdateTask(id);
  const deleteTaskMutation = useDeleteTask();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Tarea no encontrada.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/tareas">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Tareas", to: "/tareas" }, { label: task.title }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/tareas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <p className="text-sm text-muted-foreground">Creada {formatDate(task.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={task.status}
            onValueChange={(v) => updateTaskMutation.mutate({ status: taskStatusToDb(v) })}
            disabled={updateTaskMutation.isPending}
          >
            <SelectTrigger className="w-[160px]">
              {updateTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en_proceso">En proceso</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteTaskMutation.mutate(id, { onSuccess: () => navigate({ to: "/tareas" }) })}
          >
            {deleteTaskMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Descripción</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {task.description || "Sin descripción"}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              <StatusBadge status={task.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prioridad</p>
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  task.priority === "urgente"
                    ? "bg-destructive/10 text-destructive"
                    : task.priority === "alta"
                      ? "bg-warning/10 text-warning"
                      : "bg-muted/10 text-muted-foreground"
                }`}
              >
                {task.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Asignado a</p>
              <p className="font-medium">{task.assignedUserName ?? "Sin asignar"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Vencimiento</p>
              <p className="font-medium">{task.dueDate ? formatDate(task.dueDate) : "—"}</p>
            </div>
            {task.completedAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Completada</p>
                <p className="font-medium">{formatDate(task.completedAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {task.clientCompany && (
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{task.clientCompany}</p>
            </CardContent>
          </Card>
        )}
        {task.serviceDomain && (
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Servicio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{task.serviceDomain}</p>
            </CardContent>
          </Card>
        )}
        {task.domainName && (
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Dominio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{task.domainName}</p>
            </CardContent>
          </Card>
        )}
        {task.ticketNumber && (
          <Card className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="ghost" className="p-0">
                <Link to="/soporte/$id" params={{ id: task.ticketId! }} className="font-medium">
                  {task.ticketNumber}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
