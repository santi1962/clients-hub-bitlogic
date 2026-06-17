import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-success/15 text-success border-success/30" },
  pagado: { label: "Pagado", cls: "bg-success/15 text-success border-success/30" },
  completada: { label: "Completada", cls: "bg-success/15 text-success border-success/30" },
  resuelto: { label: "Resuelto", cls: "bg-success/15 text-success border-success/30" },
  emitido: { label: "Emitido", cls: "bg-info/15 text-info border-info/30" },
  abierto: { label: "Abierto", cls: "bg-info/15 text-info border-info/30" },
  en_proceso: { label: "En proceso", cls: "bg-accent/15 text-accent border-accent/30" },
  esperando_cliente: {
    label: "Esperando cliente",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  pendiente: { label: "Pendiente", cls: "bg-warning/15 text-warning border-warning/30" },
  proximo_a_vencer: {
    label: "Próximo a vencer",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  vencido: { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  suspendido: {
    label: "Suspendido",
    cls: "bg-destructive/15 text-destructive border-destructive/40",
  },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
  cerrado: { label: "Cerrado", cls: "bg-muted text-muted-foreground border-border" },
  inactivo: { label: "Inactivo", cls: "bg-muted text-muted-foreground border-border" },
  transferido: { label: "Transferido", cls: "bg-muted text-muted-foreground border-border" },
  // Avisos de pago
  borrador: { label: "Borrador", cls: "bg-muted text-muted-foreground border-border" },
  enviado: { label: "Enviado", cls: "bg-info/15 text-info border-info/30" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = map[status] ?? { label: status, cls: map.inactivo.cls };
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", entry.cls, className)}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {entry.label}
    </Badge>
  );
}
