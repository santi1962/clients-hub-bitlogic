// ============================================================
// MÓDULO CONFIGURACIÓN
// ------------------------------------------------------------
// Conexión futura:
//   GET  /api/settings           → carga consolidada
//   PATCH /api/settings/:section → guarda parcial
//   Cifrar credenciales (SMTP, APIs de pago) en backend.
// ============================================================

import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/breadcrumbs";
import { Building2, FileText, Server, Wallet, Mail, MessageCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { emailApi, hestiaApi } from "@/lib/api-client";
import { useCompanySettings, useUpdateCompanySettings } from "@/lib/queries";

export const Route = createFileRoute("/_admin/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — Bitlogic" }] }),
  component: SettingsPage,
});

function save(label: string) {
  toast.success(`${label} guardado correctamente`);
}

async function testEmailConfig() {
  const email = prompt("Ingresa un email para probar:");
  if (!email) return;

  try {
    await emailApi.test(email);
    toast.success("Email de prueba enviado correctamente");
  } catch (err) {
    toast.error((err as Error).message ?? "Error al enviar email");
  }
}

async function testHestiaConnection() {
  try {
    const result = await hestiaApi.testStatus();
    if (result.connected) {
      toast.success(`Conectado a HestiaCP: ${result.server}`);
    } else {
      toast.error(`No se pudo conectar: ${result.message}`);
    }
  } catch (err) {
    toast.error((err as Error).message ?? "Error al conectar con HestiaCP");
  }
}

function SettingsPage() {
  const { data: settings } = useCompanySettings();
  const updateMutation = useUpdateCompanySettings();

  const [formData, setFormData] = useState({
    companyName: settings?.companyName || "",
    contactEmail: settings?.contactEmail || "",
    phone: settings?.phone || "",
    taxId: settings?.taxId || "",
    address: settings?.address || "",
  });

  const handleSaveCompany = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Configuración"
        description="Datos de la empresa, facturación, hosting, pagos y comunicaciones"
      />

      <Tabs defaultValue="empresa">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full lg:w-auto">
          <TabsTrigger value="empresa">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="facturacion">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Facturación
          </TabsTrigger>
          <TabsTrigger value="hosting">
            <Server className="h-3.5 w-3.5 mr-1.5" />
            Hosting
          </TabsTrigger>
          <TabsTrigger value="pagos">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="emails">
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* EMPRESA */}
        <TabsContent value="empresa">
          <SectionCard
            title="Datos de la empresa"
            desc="Aparecen en avisos, emails y portal del cliente"
          >
            <Grid>
              <CompanyField
                label="Nombre comercial"
                value={formData.companyName}
                onChange={(v) => setFormData({...formData, companyName: v})}
              />
              <CompanyField
                label="Email de contacto"
                type="email"
                value={formData.contactEmail}
                onChange={(v) => setFormData({...formData, contactEmail: v})}
              />
              <CompanyField
                label="Teléfono"
                value={formData.phone}
                onChange={(v) => setFormData({...formData, phone: v})}
              />
              <CompanyField
                label="CUIT (opcional)"
                value={formData.taxId}
                onChange={(v) => setFormData({...formData, taxId: v})}
              />
              <CompanyField
                label="Dirección"
                value={formData.address}
                onChange={(v) => setFormData({...formData, address: v})}
                wide
              />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                    B
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("Subir logo (placeholder)")}
                  >
                    Cambiar logo
                  </Button>
                </div>
              </div>
            </Grid>
            <SaveBar onSave={handleSaveCompany} isLoading={updateMutation.isPending} />
          </SectionCard>
        </TabsContent>

        {/* FACTURACIÓN */}
        <TabsContent value="facturacion">
          <SectionCard title="Facturación y avisos">
            <Grid>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select defaultValue="ARS">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS — Peso argentino</SelectItem>
                    <SelectItem value="USD">USD — Dólar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Días de vencimiento por defecto" type="number" defaultValue="10" />
              <Field label="Prefijo numeración" defaultValue="AV-2026-" />
              <Field label="Próximo número" type="number" defaultValue="00148" />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Texto legal del aviso de pago</Label>
                <Textarea
                  rows={3}
                  defaultValue="Este aviso no constituye factura. La factura electrónica será emitida una vez acreditado el pago."
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Datos para transferencia bancaria</Label>
                <Textarea
                  rows={4}
                  defaultValue={
                    "Banco Galicia\nCBU: 0070123456789012345678\nAlias: BITLOGIC.HOSTING\nTitular: Bitlogic S.R.L. — CUIT 30-71234567-8"
                  }
                />
              </div>
            </Grid>
            <SaveBar onSave={() => save("Configuración de facturación")} />
          </SectionCard>
        </TabsContent>

        {/* HOSTING */}
        <TabsContent value="hosting">
          <SectionCard title="Hosting & HestiaCP">
            <Grid>
              <Field
                label="URL panel Hestia"
                defaultValue="https://srv01.bitlogic.com.ar:8083"
                wide
              />
              <Field label="Servidor principal" defaultValue="srv01.bitlogic.com.ar" />
              <Field label="IP servidor" defaultValue="200.45.12.34" />
              <Field label="Cuota por defecto (GB)" type="number" defaultValue="5" />
              <Field label="Cuentas email por defecto" type="number" defaultValue="10" />
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Alertas de espacio</p>
                  <p className="text-xs text-muted-foreground">
                    Avisar cuando un servicio supere el 80% de su cuota
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </Grid>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testHestiaConnection}
              >
                Probar conexión HestiaCP
              </Button>
            </div>
            <SaveBar onSave={() => save("Configuración de hosting")} />
          </SectionCard>
        </TabsContent>

        {/* PAGOS */}
        <TabsContent value="pagos">
          <SectionCard title="Métodos de pago">
            <div className="space-y-3">
              <ProviderRow
                name="MercadoPago"
                desc="Cobros con tarjeta, débito y dinero en cuenta"
                status="placeholder"
              />
              <ProviderRow
                name="PayPal"
                desc="Cobros internacionales en USD"
                status="placeholder"
              />
              <ProviderRow
                name="Transferencia bancaria"
                desc="Conciliación manual desde Cobranza"
                status="active"
              />
              <ProviderRow
                name="Efectivo / Manual"
                desc="Registro manual de pagos"
                status="active"
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* EMAILS */}
        <TabsContent value="emails">
          <SectionCard title="Servidor SMTP">
            <Grid>
              <Field label="SMTP host" defaultValue="smtp.bitlogic.com.ar" />
              <Field label="SMTP port" type="number" defaultValue="587" />
              <Field label="Usuario" defaultValue="no-reply@bitlogic.com.ar" />
              <Field label="Contraseña" type="password" defaultValue="••••••••" />
              <Field
                label="Remitente (From)"
                defaultValue="Bitlogic <no-reply@bitlogic.com.ar>"
                wide
              />
            </Grid>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testEmailConfig}
              >
                Probar envío
              </Button>
            </div>
            <SaveBar onSave={() => save("SMTP")} />
            <p className="text-xs text-muted-foreground pt-2">
              Las plantillas se editan en{" "}
              <a href="/plantillas" className="text-primary underline-offset-2 hover:underline">
                Plantillas
              </a>
              .
            </p>
          </SectionCard>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp">
          <SectionCard title="WhatsApp" desc="Integración futura con WhatsApp Business API">
            <Grid>
              <Field label="Número de contacto" defaultValue="+54 9 11 5555 1234" />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Mensaje predeterminado</Label>
                <Textarea
                  rows={3}
                  defaultValue="Hola {cliente}, te recordamos que tu servicio {servicio} vence el {fecha}. Cualquier consulta estamos disponibles. — Bitlogic"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-dashed border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Integración WhatsApp Business</p>
                  <p className="text-xs text-muted-foreground">
                    Próximamente — requiere cuenta verificada Meta
                  </p>
                </div>
                <Badge variant="outline">Próximamente</Badge>
              </div>
            </Grid>
            <SaveBar onSave={() => save("Configuración WhatsApp")} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 mt-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Field({
  label,
  defaultValue,
  type = "text",
  wide,
}: {
  label: string;
  defaultValue?: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <div className={"space-y-1.5 " + (wide ? "md:col-span-2" : "")}>
      <Label>{label}</Label>
      <Input type={type} defaultValue={defaultValue} />
    </div>
  );
}

function CompanyField({
  label,
  value,
  onChange,
  type = "text",
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <div className={"space-y-1.5 " + (wide ? "md:col-span-2" : "")}>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SaveBar({ onSave, isLoading }: { onSave: () => void; isLoading?: boolean }) {
  return (
    <div className="flex justify-end pt-2 border-t border-border/40">
      <Button size="sm" onClick={onSave} disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar cambios
      </Button>
    </div>
  );
}

function ProviderRow({
  name,
  desc,
  status,
}: {
  name: string;
  desc: string;
  status: "active" | "placeholder";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={status === "active" ? "default" : "outline"} className="text-[10px]">
          {status === "active" ? "Activo" : "Placeholder"}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info(`Configurar ${name} — próximamente`)}
        >
          Configurar
        </Button>
      </div>
    </div>
  );
}
