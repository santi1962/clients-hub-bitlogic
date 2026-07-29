import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, Loader2, Info } from "lucide-react";
import { request } from "@/lib/api-client";

export function SetupCompany() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactEmail: "",
    phone: "",
    taxId: "",
    address: "",
    currency: "ARS",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await request<Record<string, string>>("/settings/company");
        setFormData({
          companyName: data.companyName || "",
          contactEmail: data.contactEmail || "",
          phone: data.phone || "",
          taxId: data.taxId || "",
          address: data.address || "",
          currency: data.currency || "ARS",
        });
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, currency: value }));
  };

  const handleSave = async () => {
    if (!formData.companyName) {
      setError("El nombre de la empresa es requerido");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await request("/settings/company", { method: "PUT", body: formData });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Empresa</CardTitle>
        <CardDescription>
          Información básica de tu empresa. Solo datos REALES. No placeholders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm text-blue-700">
            Los datos aquí guardados se mostrarán en todos los reportes y documentos. Usa información REAL de tu empresa.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="companyName">
              Nombre Comercial <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="ej. Bitlogic S.R.L."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email de Contacto</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={handleChange}
              placeholder="ej. contacto@bitlogic.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="ej. +54 9 11 2345 6789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">CUIT</Label>
            <Input
              id="taxId"
              name="taxId"
              value={formData.taxId}
              onChange={handleChange}
              placeholder="ej. 30-12345678-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Moneda Principal <span className="text-red-500">*</span></Label>
            <Select value={formData.currency} onValueChange={handleSelectChange}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">Peso Argentino (ARS)</SelectItem>
                <SelectItem value="USD">Dólar Estadounidense (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="ej. Av. Corrientes 1234, Buenos Aires"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Configuración guardada correctamente
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Configuración"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
