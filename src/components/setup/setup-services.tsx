import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SetupServices() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Servicios de Hosting</CardTitle>
        <CardDescription>
          Servicios activos vinculados a clientes. Usa datos reales de tus registros.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Cada servicio debe incluir: cliente, dominio, plan y fecha de próximo vencimiento.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
