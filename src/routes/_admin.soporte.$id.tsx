import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/mock-data";
import {
  useTicket,
  useAddTicketMessage,
  useResolveTicket,
  useCloseTicket,
  useAssignTicket,
} from "@/lib/queries";

export const Route = createFileRoute("/_admin/soporte/$id")({
  head: () => ({ meta: [{ title: "Ticket — Bitlogic" }] }),
  component: TicketDetail,
  notFoundComponent: () => <div className="p-8">Ticket no encontrado.</div>,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const { data: ticket, isLoading, isError } = useTicket(id);
  const addMessageMutation = useAddTicketMessage(id);
  const resolveTicketMutation = useResolveTicket(id);
  const closeTicketMutation = useCloseTicket(id);

  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Ticket no encontrado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/soporte">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    addMessageMutation.mutate(
      { message, isInternal },
      {
        onSuccess: () => {
          setMessage("");
          setIsInternal(false);
        },
      },
    );
  };

  const handleResolve = async () => {
    resolveTicketMutation.mutate();
  };

  const handleClose = async () => {
    closeTicketMutation.mutate();
  };

  const messages = ticket.messages || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Soporte", to: "/soporte" }, { label: ticket.ticketNumber }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/soporte">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.ticketNumber}</h1>
            <p className="text-sm text-muted-foreground">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ticket.status !== "resuelto" && ticket.status !== "cerrado" && (
            <>
              <Button variant="outline" onClick={handleResolve} disabled={resolveTicketMutation.isPending}>
                {resolveTicketMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Resolver
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={closeTicketMutation.isPending}>
                {closeTicketMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Cerrar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{ticket.clientCompany ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Servicio asociado</p>
              <p className="font-medium">{ticket.serviceDomain ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Creado</p>
              <p className="font-medium">{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Última actividad</p>
              <p className="font-medium">
                {ticket.lastMessageAt ? formatDate(ticket.lastMessageAt) : "—"}
              </p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Resuelto</p>
                <p className="font-medium">{formatDate(ticket.resolvedAt)}</p>
              </div>
            )}
            {ticket.closedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Cerrado</p>
                <p className="font-medium">{formatDate(ticket.closedAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estado actual</p>
              <StatusBadge status={ticket.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prioridad</p>
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  ticket.priority === "urgente"
                    ? "bg-destructive/10 text-destructive"
                    : ticket.priority === "alta"
                      ? "bg-warning/10 text-warning"
                      : "bg-muted/10 text-muted-foreground"
                }`}
              >
                {ticket.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Asignado a</p>
              <p className="font-medium">{ticket.assignedUserName ?? "Sin asignar"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Conversación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes aún.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 ${msg.isInternal ? "bg-warning/10 border border-warning/20" : "bg-muted/30"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{msg.senderName}</span>
                      <span className="text-xs text-muted-foreground">{msg.senderRole}</span>
                      {msg.isInternal && (
                        <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded">
                          Nota interna
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{msg.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 pt-4 space-y-3">
            <Textarea
              placeholder="Escribe tu respuesta..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={(v) => setIsInternal(v as boolean)}
                />
                <Label htmlFor="internal" className="text-sm cursor-pointer">
                  Nota interna
                </Label>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || addMessageMutation.isPending}
                className="gap-2"
              >
                {addMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
