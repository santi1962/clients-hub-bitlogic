import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogIn, Loader2, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/mock-data";
import { request } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría — Bitlogic" }] }),
  component: AuditoriaPage,
});

interface AuditLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  created_at: string;
  old_values?: any;
  new_values?: any;
}

function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState({
    entityType: "",
    action: "",
    usuario: "",
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const query: Record<string, any> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.action) query.action = filters.action;

      const result = await request<any>("/audit", { query });
      setLogs(result.data);
      setPagination((p) => ({ ...p, total: result.meta.total }));
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogDetails(log: AuditLog) {
    try {
      const details = await request<any>(`/audit/${log.id}`);
      setSelectedLog(details);
    } catch (err) {
      console.error("Error loading log details:", err);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const entityTypes = ["cliente", "dominio", "aviso", "pago", "ticket", "tarea"];
  const actions = ["crear", "editar", "enviar", "cancelar", "renovar", "resolver", "cerrar", "responder", "marcar pagado", "completar", "reabrir", "desactivar"];

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Auditoría"
        description="Registro de todas las acciones realizadas en el sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Entidad</Label>
              <Select value={filters.entityType} onValueChange={(v) => {
                setFilters((f) => ({ ...f, entityType: v }));
                setPagination((p) => ({ ...p, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {entityTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Acción</Label>
              <Select value={filters.action} onValueChange={(v) => {
                setFilters((f) => ({ ...f, action: v }));
                setPagination((p) => ({ ...p, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input
                placeholder="Buscar usuario..."
                value={filters.usuario}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, usuario: e.target.value }));
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pagination.total} registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LogIn className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay registros</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.filter(log => !filters.usuario || log.user_name.toLowerCase().includes(filters.usuario.toLowerCase())).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {formatDate(new Date(log.created_at))}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{log.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.user_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{log.entity_type}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          {log.entity_name || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadLogDetails(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Página {pagination.page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                    }
                    disabled={pagination.page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))
                    }
                    disabled={pagination.page === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de evento</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="font-medium">{selectedLog.user_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rol</p>
                  <p className="font-medium">{selectedLog.user_role}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acción</p>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatDate(new Date(selectedLog.created_at))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entidad</p>
                  <p className="font-medium">{selectedLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="font-medium">{selectedLog.entity_name || "—"}</p>
                </div>
              </div>

              {selectedLog.old_values && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Valores anteriores</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Valores nuevos</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
