import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useCreateTicket, useMyServices } from "@/lib/queries";

export const Route = createFileRoute("/portal/tickets/nuevo")({
  component: NuevoTicket,
});

function NuevoTicket() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [serviceId, setServiceId] = useState<string | undefined>(undefined);

  const { data: servicesData } = useMyServices();
  const services = servicesData?.data ?? [];

  const mutation = useCreateTicket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    mutation.mutate(
      { subject: subject.trim(), priority, serviceId: serviceId || undefined },
      { onSuccess: () => navigate({ to: "/portal/tickets" }) },
    );
  };

  return (
    <div className="max-w-lg">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/portal/tickets">
          <ArrowLeft className="h-4 w-4" /> Volver a mis tickets
        </Link>
      </Button>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Abrir nuevo ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Asunto *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describí brevemente el problema"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {services.length > 0 && (
              <div className="space-y-1.5">
                <Label>Servicio relacionado (opcional)</Label>
                <Select
                  value={serviceId ?? "__none__"}
                  onValueChange={(v) => setServiceId(v === "__none__" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin servicio específico</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error)?.message ?? "Error al crear el ticket. Intentá nuevamente."}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/portal/tickets">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={!subject.trim() || mutation.isPending}>
                {mutation.isPending ? "Creando..." : "Abrir ticket"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
