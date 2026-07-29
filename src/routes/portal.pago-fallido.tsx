import { createFileRoute, Link } from "@tanstack/react-router";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/pago-fallido")({
  component: PagoFallido,
});

function PagoFallido() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <XCircle className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">No se pudo procesar el pago</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Hubo un problema con tu pago. Podés intentarlo de nuevo o contactarnos si el problema
          persiste.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link to="/portal/avisos">
            <ArrowLeft className="h-4 w-4" /> Volver a avisos
          </Link>
        </Button>
        <Button asChild>
          <Link to="/portal/avisos">
            <RefreshCw className="h-4 w-4" /> Intentar de nuevo
          </Link>
        </Button>
      </div>
    </div>
  );
}
