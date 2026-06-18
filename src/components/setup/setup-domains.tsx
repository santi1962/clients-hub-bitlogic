import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SetupDomains() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dominios</CardTitle>
        <CardDescription>
          Dominios registrados y sus fechas de vencimiento. Información crítica para recordatorios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Incluye: dominio, cliente, registrador, fecha de vencimiento y costo.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
