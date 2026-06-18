/**
 * Bitlogic — Workflows operativos (modal wizards).
 *
 * Placeholder: Workflows en desarrollo.
 * Se implementarán en próximas versiones.
 */
import { Button } from "@/components/ui/button";

const WorkflowPlaceholder = ({ title }: { title: string }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs text-muted-foreground">Función en desarrollo</p>
    <Button variant="outline" size="sm" disabled>
      {title}
    </Button>
  </div>
);

export function NewClientWorkflow() {
  return <WorkflowPlaceholder title="Iniciar alta de cliente" />;
}

export function GenerateNoticeWorkflow() {
  return <WorkflowPlaceholder title="Generar aviso" />;
}

export function RegisterPaymentWorkflow() {
  return <WorkflowPlaceholder title="Registrar pago" />;
}

export function SuspendServiceWorkflow() {
  return <WorkflowPlaceholder title="Suspender servicio" />;
}

export function ReactivateServiceWorkflow() {
  return <WorkflowPlaceholder title="Reactivar servicio" />;
}

export function ChangePlanWorkflow() {
  return <WorkflowPlaceholder title="Cambiar plan" />;
}
