import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  UserPlus,
  FileText,
  Wallet,
  AlertTriangle,
  RotateCw,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  NewClientWorkflow,
  GenerateNoticeWorkflow,
  RegisterPaymentWorkflow,
  SuspendServiceWorkflow,
  ReactivateServiceWorkflow,
  ChangePlanWorkflow,
} from "@/components/workflows";
import { ActivityTimeline } from "@/components/activity-timeline";

export const Route = createFileRoute("/_admin/workflows")({
  head: () => ({ meta: [{ title: "Workflows — Bitlogic" }] }),
  component: WorkflowsPage,
});

const WORKFLOWS = [
  {
    title: "Alta de cliente + hosting",
    desc: "Onboarding completo en 4 pasos: cliente, servicio, configuración inicial y resumen.",
    icon: UserPlus,
    color: "from-sky-500/20 to-sky-500/0",
    badge: "Wizard 4 pasos",
    component: <NewClientWorkflow />,
  },
  {
    title: "Generar aviso de pago",
    desc: "Seleccioná cliente y servicio, definí el período y emití el aviso con vista previa imprimible.",
    icon: FileText,
    color: "from-amber-500/20 to-amber-500/0",
    badge: "Facturación",
    component: <GenerateNoticeWorkflow />,
  },
  {
    title: "Registrar pago",
    desc: "Ingresá un pago recibido (Mercado Pago, PayPal, transferencia) y actualizá deudas y avisos.",
    icon: Wallet,
    color: "from-emerald-500/20 to-emerald-500/0",
    badge: "Cobranza",
    component: <RegisterPaymentWorkflow />,
  },
  {
    title: "Suspender servicio",
    desc: "Detené un servicio por falta de pago u otro motivo. Genera tarea de seguimiento y auditoría.",
    icon: AlertTriangle,
    color: "from-rose-500/20 to-rose-500/0",
    badge: "Acción crítica",
    component: <SuspendServiceWorkflow />,
  },
  {
    title: "Reactivar servicio",
    desc: "Volvé a poner en línea un servicio suspendido. Queda registrado en el timeline.",
    icon: RotateCw,
    color: "from-emerald-500/20 to-emerald-500/0",
    badge: "Recovery",
    component: <ReactivateServiceWorkflow />,
  },
  {
    title: "Cambiar plan",
    desc: "Upgrade o downgrade con cálculo automático de diferencia y aviso de ajuste opcional.",
    icon: ArrowUpRight,
    color: "from-violet-500/20 to-violet-500/0",
    badge: "Comercial",
    component: <ChangePlanWorkflow />,
  },
];

function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" /> Workflows
          </h1>
          <p className="text-sm text-muted-foreground">
            Procesos guiados para las operaciones más comunes del negocio. Cada uno deja registro en
            el audit log.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          6 flujos disponibles
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOWS.map((w) => (
          <Card key={w.title} className="relative overflow-hidden">
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${w.color}`}
            />
            <CardHeader className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 ring-1 ring-border">
                  <w.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {w.badge}
                </Badge>
              </div>
              <CardTitle className="pt-3 text-base">{w.title}</CardTitle>
              <CardDescription>{w.desc}</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <Separator className="mb-3" />
              {w.component}
            </CardContent>
          </Card>
        ))}
      </div>

      <ActivityTimeline title="Eventos generados por workflows" limit={20} />
    </div>
  );
}
