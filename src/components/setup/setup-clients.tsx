import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SetupClients() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Reales</CardTitle>
        <CardDescription>
          Lista de clientes actuales. Carga solo los que realmente tienes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Usa el formulario de Clientes en la sección de Administración para crear clientes reales.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
