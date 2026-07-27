import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ListChecks, Clock, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { useTasks, useCreateTask, useClients } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { taskPriorityToDb } from "@/lib/api-mappers";

export const Route = createFileRoute("/_admin/tareas/")({
  head: () => ({ meta: [{ title: "Tareas — Bitlogic" }] }),
  component: TareasPage,
});

function Kpi({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
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
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal", dueDate: "", clientId: "" });

  const { data: tasksData, isLoading } = useTasks({
    status: status === "todos" ? undefined : status,
    priority: priority === "todos" ? undefined : priority,
    search: search || undefined,
  });
  const { data: clientsData } = useClients();
  const clientList = clientsData?.data ?? [];
  const createMutation = useCreateTask();

  const tasks = tasksData?.data ?? [];
  const pendingCount = tasks.filter((t) => t.status === "pendiente").length;
  const inProgressCount = tasks.filter((t) => t.status === "en_proceso").length;
  const urgentCount = tasks.filter((t) => t.priority === "urgente").length;
  const completedCount = tasks.filter((t) => t.status === "completada").length;

  const handleCreate = () => {
    if (!form.title) return;
    createMutation.mutate(
      {
        title: form.title,
        description: form.description || null,
        priority: taskPriorityToDb(form.priority),
        dueDate: form.dueDate || null,
        clientId: form.clientId || null,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setForm({ title: "", description: "", priority: "normal", dueDate: "", clientId: "" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tareas internas</h1>
          <p className="text-sm text-muted-foreground">Gestión de tareas operativas y seguimiento.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva tarea
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Pendientes" value={pendingCount} icon={ListChecks} color="bg-info/15 text-info" />
        <Kpi label="En proceso" value={inProgressCount} icon={Clock} color="bg-accent/15 text-accent" />
        <Kpi label="Urgentes" value={urgentCount} icon={AlertTriangle} color="bg-destructive/15 text-destructive" />
        <Kpi label="Completadas" value={completedCount} icon={CheckCircle2} color="bg-success/15 text-success" />
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
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos estados</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="completada">Completada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
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
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState title="Sin tareas" description="No hay tareas que coincidan con los filtros." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          t.priority === "urgente" && "border-destructive/40 bg-destructive/10 text-destructive",
                          t.priority === "alta" && "border-warning/40 bg-warning/10 text-warning",
                          t.priority === "baja" && "border-muted/40 text-muted-foreground",
                        )}
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-sm">{t.assignedUserName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.dueDate ? formatDate(t.dueDate) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.clientCompany ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/tareas/$id" params={{ id: t.id }}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                placeholder="ej: Renovar dominio cliente X"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                placeholder="Detalle opcional"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente (opcional)</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Sin cliente asociado" /></SelectTrigger>
                <SelectContent>
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company ?? c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button disabled={!form.title || createMutation.isPending} onClick={handleCreate}>
              {createMutation.isPending ? "Creando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
