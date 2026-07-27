import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Send, Trash2, X,
  Paperclip, Mic,
} from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { formatDate } from "@/lib/format";
import { useTicket, useAddTicketMessage, useResolveTicket, useCloseTicket, useDeleteTicket } from "@/lib/queries";
import { getAccessToken, API_BASE_URL, ticketAttachmentUrl } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { io } from "socket.io-client";
import { SecureAttachment } from "@/components/secure-attachment";

export const Route = createFileRoute("/_admin/soporte/$id")({
  head: () => ({ meta: [{ title: "Ticket — Bitlogic" }] }),
  component: TicketDetail,
  notFoundComponent: () => <div className="p-8">Ticket no encontrado.</div>,
});

// ─── Audio recorder hook ─────────────────────────────────────
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.start();
    mrRef.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stop = useCallback((): Promise<File> => {
    return new Promise((resolve) => {
      const mr = mrRef.current!;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        mr.stream.getTracks().forEach((t) => t.stop());
        resolve(file);
      };
      mr.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setSeconds(0);
    });
  }, []);

  const cancel = useCallback(() => {
    if (mrRef.current?.state !== "inactive") {
      mrRef.current?.stream.getTracks().forEach((t) => t.stop());
      mrRef.current?.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  }, []);

  return { recording, seconds, start, stop, cancel };
}

// AudioPlayer eliminado — se usa SecureAttachment

// ─── Send file via FormData ───────────────────────────────────
async function sendFileMessage(
  ticketId: string,
  file: File,
  isInternal: boolean,
): Promise<void> {
  const token = getAccessToken();
  const form = new FormData();
  form.append("file", file);
  if (isInternal) form.append("isInternal", "true");
  const res = await fetch(`${API_BASE_URL}/support/${ticketId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
}

// ─── Main component ──────────────────────────────────────────
function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: ticket, isLoading, isError, refetch } = useTicket(id);
  const addMessageMutation = useAddTicketMessage(id);
  const resolveTicketMutation = useResolveTicket(id);
  const closeTicketMutation = useCloseTicket(id);
  const deleteTicketMutation = useDeleteTicket(id);
  const recorder = useAudioRecorder();
  const qc = useQueryClient();

  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // WebSocket: escucha mensajes nuevos en tiempo real
  useEffect(() => {
    const token = getAccessToken();
    const socket = io(API_BASE_URL.replace("/api", ""), {
      auth: { token },
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    socket.emit("join:ticket", id);
    socket.on("ticket:message", (msg) => {
      qc.setQueryData(["tickets", "detail", id], (old: any) => {
        if (!old) return old;
        if (old.messages?.some((m: any) => m.id === msg.id)) return old;
        return { ...old, messages: [...(old.messages ?? []), msg] };
      });
    });
    return () => {
      socket.emit("leave:ticket", id);
      socket.disconnect();
    };
  }, [id, qc]);

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

  const handleSendText = () => {
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

  const handleSendFile = async (file: File) => {
    setSendingFile(true);
    setPendingFile(null);
    try {
      await sendFileMessage(id, file, isInternal);
      await refetch();
      toast.success("Archivo enviado");
    } catch (e: any) {
      toast.error(e.message ?? "Error al enviar archivo");
    } finally {
      setSendingFile(false);
    }
  };

  const handleStopAudio = async () => {
    const file = await recorder.stop();
    await handleSendFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const isSending = addMessageMutation.isPending || sendingFile;
  const messages = ticket.messages || [];
  const isClosed = ticket.status === "resuelto" || ticket.status === "cerrado";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Soporte", to: "/soporte" }, { label: ticket.ticketNumber ?? "Ticket" }]} />

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
          {!isClosed && (
            <>
              <Button variant="outline" onClick={() => resolveTicketMutation.mutate()} disabled={resolveTicketMutation.isPending}>
                {resolveTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Resolver
              </Button>
              <Button variant="outline" onClick={() => closeTicketMutation.mutate()} disabled={closeTicketMutation.isPending}>
                {closeTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Cerrar
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteTicketMutation.isPending}>
                {deleteTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar ticket?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es permanente. Se eliminarán el ticket{" "}
                  <strong>{ticket.ticketNumber}</strong> y todos sus mensajes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() =>
                    deleteTicketMutation.mutate(undefined, {
                      onSuccess: () => navigate({ to: "/soporte" }),
                    })
                  }
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              <p className="font-medium">{ticket.lastMessageAt ? formatDate(ticket.lastMessageAt) : "—"}</p>
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
              <span className={cn(
                "inline-block px-2 py-1 rounded text-xs font-medium",
                ticket.priority === "urgente" ? "bg-destructive/10 text-destructive"
                  : ticket.priority === "alta" ? "bg-warning/10 text-warning"
                  : "bg-muted/10 text-muted-foreground"
              )}>
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

      {/* Conversación */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Conversación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages */}
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes aún.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {messages.map((msg: any) => {
                const fileUrl = ticketAttachmentUrl(msg.attachment_url, "staff");
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-lg p-3",
                      msg.is_internal
                        ? "bg-warning/10 border border-warning/20"
                        : "bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{msg.sender_name}</span>
                        <span className="text-xs text-muted-foreground">{msg.sender_role}</span>
                        {msg.is_internal && (
                          <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded">
                            Nota interna
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
                    </div>
                    {msg.message && <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>}
                    {fileUrl && msg.attachment_type && (
                      <div className="mt-2">
                        <SecureAttachment
                          url={fileUrl}
                          type={msg.attachment_type as "image" | "audio" | "file"}
                          name={msg.attachment_name}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Input area */}
          {isClosed ? (
            <p className="text-sm text-muted-foreground text-center border-t border-border/60 pt-4">
              Ticket cerrado. Para continuar, abrí un ticket nuevo.
            </p>
          ) : (
            <div className="border-t border-border/60 pt-4 space-y-3">
              {/* Pending file preview */}
              {pendingFile && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{pendingFile.name}</span>
                  <button onClick={() => setPendingFile(null)}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                  <Button size="sm" disabled={isSending} onClick={() => handleSendFile(pendingFile)}>
                    {isSending ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              )}

              {/* Recording indicator */}
              {recorder.recording && (
                <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-destructive font-medium">Grabando… {recorder.seconds}s</span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={recorder.cancel}>Cancelar</Button>
                    <Button size="sm" onClick={handleStopAudio} disabled={isSending}>
                      {isSending ? "Enviando…" : "Enviar audio"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Text input row */}
              {!recorder.recording && !pendingFile && (
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder="Escribí tu respuesta… (Enter para enviar, Shift+Enter para nueva línea)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-h-[44px] max-h-[120px] resize-none"
                    rows={2}
                    disabled={isSending}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPendingFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    title="Adjuntar archivo"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={recorder.start}
                    disabled={isSending}
                    title="Grabar audio"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSendText}
                    disabled={!message.trim() || isSending}
                    title="Enviar"
                  >
                    {addMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {/* Internal note toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={(v) => setIsInternal(v as boolean)}
                />
                <Label htmlFor="internal" className="text-sm cursor-pointer select-none">
                  Nota interna (solo visible para el equipo)
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
