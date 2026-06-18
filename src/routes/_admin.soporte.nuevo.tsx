import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useCreateTicket } from "@/lib/queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_admin/soporte/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo Ticket — Bitlogic" }] }),
  component: NewTicketPage,
});

function NewTicketPage() {
  const navigate = useNavigate();
  const createMutation = useCreateTicket();

  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");

  const handleSubmit = () => {
    if (!subject.trim()) {
      alert("Por favor ingresa un asunto");
      return;
    }

    createMutation.mutate(
      {
        subject,
        priority,
      },
      {
        onSuccess: (ticket) => {
          navigate({ to: `/soporte/${ticket.id}` });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Soporte", to: "/soporte" }, { label: "Nuevo ticket" }]} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/soporte" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crear nuevo ticket</h1>
          <p className="text-sm text-muted-foreground">
            Describe tu problema para que nuestro equipo pueda ayudarte
          </p>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Información del ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Asunto *</label>
            <Input
              placeholder="Ej: El sitio web está lento"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prioridad</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!subject.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                "Crear ticket"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/soporte" })}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
