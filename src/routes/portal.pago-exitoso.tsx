import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/portal/pago-exitoso")({
  component: PagoExitoso,
});

function PagoExitoso() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">¡Pago recibido!</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Tu pago fue procesado correctamente. Vamos a confirmar el acreditación en breve y
          actualizaremos el estado de tu aviso.
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
