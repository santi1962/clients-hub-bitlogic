import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SetupPlans() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planes de Hosting</CardTitle>
        <CardDescription>
          Gestiona los planes que ofrecerás a tus clientes. Los precios deben ser reales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Los planes se crearán a través de la API. Por ahora puedes verlos en la sección de
            Servicios.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
