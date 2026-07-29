import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Paperclip, Mic, Play, Pause, Download, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { request, API_BASE_URL, getAccessToken, ticketAttachmentUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { io, type Socket } from "socket.io-client";
import { useSecureUrl } from "@/hooks/useSecureUrl";

export const Route = createFileRoute("/portal/tickets/$id")({
  component: TicketChat,
});

// ─── Types ───────────────────────────────────────────────────
interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  message: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  client_name: string;
  messages: Message[];
}

// ─── API helpers ─────────────────────────────────────────────
async function fetchTicket(id: string): Promise<Ticket> {
  return request<Ticket>(`/portal/tickets/${id}`);
}

async function sendTextMessage(ticketId: string, message: string): Promise<Message> {
  return request<Message>(`/portal/tickets/${ticketId}/messages`, {
    method: "POST",
    body: { message },
  });
}

async function sendFileMessage(ticketId: string, file: File): Promise<Message> {
  const token = (await import("@/lib/api-client")).getAccessToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/portal/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Audio Recorder ──────────────────────────────────────────
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.start();
    mediaRecorderRef.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stop = useCallback((): Promise<File> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current!;
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
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current?.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  }, []);

  return { recording, seconds, start, stop, cancel };
}

// ─── Audio Player ─────────────────────────────────────────────
function AudioPlayer({ url, name }: { url: string; name: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current!;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 min-w-[200px]">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className="shrink-0 text-white/80 hover:text-white">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className="h-1 rounded-full bg-white/20">
          <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-0.5 text-[10px] text-white/50">{name ?? "Audio"} · {fmt(duration)}</p>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────
function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const secureUrl = useSecureUrl(ticketAttachmentUrl(msg.attachment_url, "portal"));
  const fileUrl = secureUrl;

  return (
    <div className={cn("flex flex-col gap-0.5 max-w-[75%]", isOwn ? "self-end items-end" : "self-start items-start")}>
      {!isOwn && (
        <span className="text-[11px] text-muted-foreground px-1">{msg.sender_name}</span>
      )}
      <div className={cn(
        "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
        isOwn
          ? "bg-accent text-accent-foreground rounded-br-sm"
          : "bg-card border border-border/60 text-foreground rounded-bl-sm"
      )}>
        {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
        {fileUrl && msg.attachment_type === "audio" && (
          <AudioPlayer url={fileUrl} name={msg.attachment_name} />
        )}
        {fileUrl && msg.attachment_type === "image" && (
          <img src={fileUrl} alt={msg.attachment_name ?? "imagen"} className="max-w-[240px] rounded-lg" />
        )}
        {fileUrl && msg.attachment_type === "file" && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download
            className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 hover:bg-black/20">
            <Download className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs">{msg.attachment_name ?? "Archivo"}</span>
          </a>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{time}</span>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
function TicketChat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorder = useAudioRecorder();

  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await fetchTicket(id);
      setTicket(data);
      if (!silent) setLoading(false);
    } catch (e: any) {
      if (!silent) { setError(e.message); setLoading(false); }
    }
  }, [id]);

  // Initial load + WebSocket para mensajes en tiempo real
  useEffect(() => {
    load();

    const token = getAccessToken();
    const socket = io(API_BASE_URL.replace("/api", ""), {
      auth: { token },
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.emit("join:ticket", id);

    socket.on("ticket:message", (msg) => {
      setTicket((prev) => {
        if (!prev) return prev;
        // Evitar duplicados si el mensaje ya está
        if (prev.messages.some((m) => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    });

    socket.on("connect_error", () => {
      // Fallback: polling cada 8s si WebSocket falla
      const interval = setInterval(() => load(true), 8000);
      socketRef.current = null;
      return () => clearInterval(interval);
    });

    socketRef.current = socket;
    return () => {
      socket.emit("leave:ticket", id);
      socket.disconnect();
    };
  }, [id, load]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const handleSendText = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendTextMessage(id, text.trim());
      setText("");
      await load(true);
    } catch (e: any) {
      toast.error(e.message ?? "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const handleSendFile = async (file: File) => {
    setSending(true);
    setPendingFile(null);
    try {
      await sendFileMessage(id, file);
      await load(true);
    } catch (e: any) {
      toast.error(e.message ?? "Error al enviar archivo");
    } finally {
      setSending(false);
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

  if (loading) return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p>{error}</p>
      <Button variant="outline" onClick={() => navigate({ to: "/portal/tickets" })}>Volver</Button>
    </div>
  );

  const statusColors: Record<string, string> = {
    open: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    waiting_client: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    resolved: "bg-muted text-muted-foreground border-border",
    closed: "bg-muted text-muted-foreground border-border",
  };

  const statusLabel: Record<string, string> = {
    open: "Abierto", in_progress: "En proceso",
    waiting_client: "Esperando respuesta", resolved: "Resuelto", closed: "Cerrado",
  };

  const isClosed = ticket!.status === "closed" || ticket!.status === "resolved";

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 pb-4 border-b border-border/60">
        <Button asChild variant="ghost" size="sm" className="shrink-0 mt-0.5">
          <Link to="/portal/tickets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket!.ticket_number}</span>
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", statusColors[ticket!.status] ?? statusColors.open)}>
              {statusLabel[ticket!.status] ?? ticket!.status}
            </span>
          </div>
          <h2 className="mt-0.5 font-semibold leading-tight truncate">{ticket!.subject}</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
        {ticket!.messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Aún no hay mensajes. Escribí tu consulta abajo.
          </p>
        ) : (
          ticket!.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.sender_role === "cliente"}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {isClosed ? (
        <div className="border-t border-border/60 pt-4 text-center text-sm text-muted-foreground">
          Este ticket está cerrado. Podés abrir uno nuevo si necesitás más ayuda.
        </div>
      ) : (
        <div className="border-t border-border/60 pt-3 space-y-2">
          {/* Pending file preview */}
          {pendingFile && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{pendingFile.name}</span>
              <button onClick={() => setPendingFile(null)}>
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
              <Button size="sm" disabled={sending} onClick={() => handleSendFile(pendingFile)}>
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          )}

          {/* Audio recording indicator */}
          {recorder.recording && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-destructive font-medium">Grabando… {recorder.seconds}s</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={recorder.cancel}>Cancelar</Button>
                <Button size="sm" onClick={handleStopAudio} disabled={sending}>
                  {sending ? "Enviando…" : "Enviar audio"}
                </Button>
              </div>
            </div>
          )}

          {/* Text input row */}
          {!recorder.recording && !pendingFile && (
            <div className="flex items-end gap-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                className="flex-1 min-h-[44px] max-h-[120px] resize-none"
                rows={1}
                disabled={sending}
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
                disabled={sending}
                title="Adjuntar archivo"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={recorder.start}
                disabled={sending}
                title="Grabar audio"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleSendText}
                disabled={!text.trim() || sending}
                title="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
