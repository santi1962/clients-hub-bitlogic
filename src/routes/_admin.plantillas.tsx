import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/breadcrumbs";
import { FileText, Save, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/plantillas")({
  head: () => ({ meta: [{ title: "Plantillas — Bitlogic" }] }),
  component: TemplatesPage,
});

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  tags: string[];
}

const TEMPLATES: Template[] = [
  {
    id: "venc",
    name: "Aviso de vencimiento",
    subject: "Tu servicio {servicio} vence el {fecha}",
    body: "Hola {cliente},\n\nTe recordamos que el servicio {servicio} vence el {fecha} por un monto de {monto}.\n\nPodés abonar desde tu portal: {link_portal}\n\nSaludos,\nEquipo Bitlogic",
    tags: ["{cliente}", "{servicio}", "{fecha}", "{monto}", "{link_portal}"],
  },
  {
    id: "pago_ok",
    name: "Pago recibido",
    subject: "Recibimos tu pago — {monto}",
    body: "Hola {cliente},\n\nConfirmamos la recepción de tu pago por {monto} correspondiente a {servicio}.\n\n¡Gracias por confiar en nosotros!\n\nBitlogic",
    tags: ["{cliente}", "{monto}", "{servicio}"],
  },
  {
    id: "suspendido",
    name: "Servicio suspendido",
    subject: "Suspensión del servicio {servicio}",
    body: "Hola {cliente},\n\nPor falta de pago hemos suspendido temporalmente el servicio {servicio}. Para reactivarlo, regularizá el aviso vencido desde el portal.\n\nBitlogic",
    tags: ["{cliente}", "{servicio}"],
  },
  {
    id: "reactivado",
    name: "Servicio reactivado",
    subject: "Servicio {servicio} reactivado",
    body: "Hola {cliente},\n\nTu servicio {servicio} fue reactivado. Disculpá las molestias.\n\nBitlogic",
    tags: ["{cliente}", "{servicio}"],
  },
  {
    id: "ticket",
    name: "Respuesta inicial de ticket",
    subject: "Recibimos tu consulta #{ticket}",
    body: "Hola {cliente},\n\nRecibimos tu consulta y un técnico la está revisando. Te responderemos a la brevedad.\n\nNúmero de ticket: #{ticket}\n\nBitlogic",
    tags: ["{cliente}", "{ticket}"],
  },
  {
    id: "dominio",
    name: "Recordatorio de dominio",
    subject: "Tu dominio {dominio} vence pronto",
    body: "Hola {cliente},\n\nEl dominio {dominio} vence el {fecha}. Te recomendamos renovarlo con anticipación para evitar la pérdida.\n\nBitlogic",
    tags: ["{cliente}", "{dominio}", "{fecha}"],
  },
];

function TemplatesPage() {
  const [active, setActive] = useState<Template>(TEMPLATES[0]);
  const [subject, setSubject] = useState(active.subject);
  const [body, setBody] = useState(active.body);

  const select = (t: Template) => {
    setActive(t);
    setSubject(t.subject);
    setBody(t.body);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas de comunicación"
        description="Editá los emails y mensajes automáticos del sistema"
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar plantillas */}
        <Card className="border-border/60 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Plantillas disponibles</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ul className="space-y-1">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => select(t)}
                    className={
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition " +
                      (active.id === t.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "hover:bg-muted/40")
                    }
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{active.name}</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Editor visual
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cuerpo del mensaje</Label>
              <Textarea
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Variables disponibles</Label>
              <div className="flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setBody((b) => b + t);
                      toast.info(`Insertada ${t}`);
                    }}
                    className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-mono hover:bg-primary/15 hover:text-primary"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Previsualización (placeholder)")}
              >
                <Eye className="mr-2 h-4 w-4" />
                Previsualizar
              </Button>
              <Button size="sm" onClick={() => toast.success(`${active.name} guardada`)}>
                <Save className="mr-2 h-4 w-4" />
                Guardar plantilla
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
