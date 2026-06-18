import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function SetupUsers() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios del Portal</CardTitle>
        <CardDescription>
          Clientes que tendrán acceso al portal para ver sus servicios y pagos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Solo crea usuarios para clientes que realmente usarán el portal. Cada usuario es
            vinculado a un cliente específico.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
