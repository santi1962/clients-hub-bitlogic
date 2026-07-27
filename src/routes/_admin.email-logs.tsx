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
import { Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/format";
import { emailApi } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/email-logs")({
  head: () => ({ meta: [{ title: "Logs de Email — Bitlogic" }] }),
  component: EmailLogsPage,
});

const TYPE_LABEL: Record<string, string> = {
  payment_notice: "Aviso Pago",
  payment_received: "Pago Recibido",
  ticket_reply: "Respuesta",
  domain_reminder: "Recordatorio",
  service_suspended: "Suspensión",
  service_reactivated: "Reactivación",
  test: "Prueba",
};

interface EmailLog {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    recipient: "",
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const result = await emailApi.listLogs({
        status: filters.status || undefined,
        type: filters.type || undefined,
        recipient: filters.recipient || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });
      setLogs(result.data);
      setPagination((p) => ({ ...p, total: result.meta.total }));
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Logs de Email"
        description="Historial de emails enviados, pendientes y fallidos"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={filters.status} onValueChange={(v) => {
                setFilters((f) => ({ ...f, status: v }));
                setPagination((p) => ({ ...p, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Fallidos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={filters.type} onValueChange={(v) => {
                setFilters((f) => ({ ...f, type: v }));
                setPagination((p) => ({ ...p, page: 1 }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="payment_notice">Aviso de Pago</SelectItem>
                  <SelectItem value="payment_received">Pago Recibido</SelectItem>
                  <SelectItem value="ticket_reply">Respuesta de Ticket</SelectItem>
                  <SelectItem value="domain_reminder">Recordatorio de Dominio</SelectItem>
                  <SelectItem value="service_suspended">Servicio Suspendido</SelectItem>
                  <SelectItem value="service_reactivated">Servicio Reactivado</SelectItem>
                  <SelectItem value="test">Prueba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destinatario</Label>
              <Input
                placeholder="Email..."
                value={filters.recipient}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, recipient: e.target.value }));
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
              <Mail className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay logs que mostrar</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Asunto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-medium">
                          {TYPE_LABEL[log.type] ?? log.type}
                        </TableCell>
                        <TableCell className="text-xs">{log.recipient}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell>
                          {log.status === "sent" ? (
                            <Badge variant="outline" className="bg-green-50">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Enviado
                            </Badge>
                          ) : log.status === "failed" ? (
                            <Badge variant="destructive" className="bg-red-50">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Fallido
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.sent_at ? formatDate(log.sent_at) : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate text-red-600">
                          {log.error_message || "—"}
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
    </div>
  );
}
