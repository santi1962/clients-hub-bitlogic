import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/pago-pendiente")({
  component: PagoPendiente,
});

function PagoPendiente() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
        <Clock className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pago en proceso</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Tu pago está siendo procesado. Te notificaremos cuando se acredite. Esto puede demorar
          hasta 24 horas según el método de pago.
        </p>
      </div>
      <Button asChild>
        <Link to="/portal/avisos">
          <ArrowLeft className="h-4 w-4" /> Ver mis avisos
        </Link>
      </Button>
    </div>
  );
}
