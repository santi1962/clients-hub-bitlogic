import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/breadcrumbs";
import { Building2, FileText, Server, Wallet, Mail, Save, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { emailApi, hestiaApi, settingsApi, API_BASE_URL } from "@/lib/api-client";
import {
  useCompanySettings,
  useUpdateCompanySettings,
  useBillingSettings,
  useUpdateBillingSettings,
  useHostingSettings,
  useUpdateHostingSettings,
  usePaymentSettings,
  useUpdatePaymentSettings,
  useEmailSettings,
} from "@/lib/queries";

export const Route = createFileRoute("/_admin/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — Bitlogic" }] }),
  component: SettingsPage,
});

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
  // Company
  const { data: companyData } = useCompanySettings();
  const updateCompany = useUpdateCompanySettings();
  const [company, setCompany] = useState({
    companyName: "",
    contactEmail: "",
    phone: "",
    taxId: "",
    address: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Billing
  const { data: billingData } = useBillingSettings();
  const updateBilling = useUpdateBillingSettings();
  const [billing, setBilling] = useState({
    currency: "ARS",
    defaultPaymentDays: 10,
    invoicePrefix: "AV-2026-",
    nextInvoiceNumber: 148,
    invoiceLegalText: "",
    bankData: "",
  });

  // Hosting
  const { data: hostingData } = useHostingSettings();
  const updateHosting = useUpdateHostingSettings();
  const [hosting, setHosting] = useState({
    hestiaUrl: "",
    mainServer: "",
    serverIp: "",
    defaultQuotaGb: 5,
    defaultEmails: 10,
    spaceAlertsEnabled: true,
  });

  // Payments
  const { data: paymentsData } = usePaymentSettings();
  const updatePayments = useUpdatePaymentSettings();
  const [payments, setPayments] = useState({
    mercadoPagoEnabled: false,
    paypalEnabled: false,
    bankTransferEnabled: true,
    manualPaymentEnabled: true,
  });

  // Email (solo lectura — se edita en backend/.env)
  const { data: emailData } = useEmailSettings();

  // Load data into form when API responds
  useEffect(() => {
    if (companyData) {
      setCompany(companyData as typeof company);
      setLogoUrl((companyData as any).logoUrl ?? null);
    }
  }, [companyData]);

  useEffect(() => {
    if (billingData) setBilling(billingData as typeof billing);
  }, [billingData]);

  useEffect(() => {
    if (hostingData) setHosting(hostingData as typeof hosting);
  }, [hostingData]);

  useEffect(() => {
    if (paymentsData) setPayments(paymentsData as typeof payments);
  }, [paymentsData]);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Configuración"
        description="Datos de la empresa, facturación, hosting, pagos y comunicaciones"
      />

      <Tabs defaultValue="empresa">
        <TabsList className="grid grid-cols-3 lg:grid-cols-5 w-full lg:w-auto">
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
        </TabsList>

        {/* EMPRESA */}
        <TabsContent value="empresa">
          <SectionCard title="Datos de la empresa" desc="Aparecen en avisos, emails y portal del cliente">
            <Grid>
              <Field
                label="Nombre comercial"
                value={company.companyName}
                onChange={(v) => setCompany({ ...company, companyName: v })}
              />
              <Field
                label="Email de contacto"
                type="email"
                value={company.contactEmail}
                onChange={(v) => setCompany({ ...company, contactEmail: v })}
              />
              <Field
                label="Teléfono"
                value={company.phone}
                onChange={(v) => setCompany({ ...company, phone: v })}
              />
              <Field
                label="CUIT (opcional)"
                value={company.taxId}
                onChange={(v) => setCompany({ ...company, taxId: v })}
              />
              <Field
                label="Dirección"
                value={company.address}
                onChange={(v) => setCompany({ ...company, address: v })}
                wide
              />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl.startsWith("/api") ? `${API_BASE_URL.replace("/api", "")}${logoUrl}` : logoUrl}
                      alt="Logo"
                      className="h-12 w-12 rounded-lg object-contain border border-border/60 bg-card"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                      {company.companyName?.[0]?.toUpperCase() || "B"}
                    </div>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingLogo(true);
                      try {
                        const { logoUrl: url } = await settingsApi.uploadLogo(file);
                        setLogoUrl(url);
                        toast.success("Logo actualizado");
                      } catch (err: any) {
                        toast.error(err.message ?? "Error al subir logo");
                      } finally {
                        setUploadingLogo(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {uploadingLogo ? "Subiendo…" : "Cambiar logo"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG o SVG · máx. 2 MB</p>
              </div>
            </Grid>
            <SaveBar onSave={() => updateCompany.mutate(company)} isLoading={updateCompany.isPending} />
          </SectionCard>
        </TabsContent>

        {/* FACTURACIÓN */}
        <TabsContent value="facturacion">
          <SectionCard title="Facturación y avisos">
            <Grid>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={billing.currency} onValueChange={(v) => setBilling({ ...billing, currency: v })}>
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
              <Field
                label="Días de vencimiento por defecto"
                type="number"
                value={billing.defaultPaymentDays.toString()}
                onChange={(v) => setBilling({ ...billing, defaultPaymentDays: parseInt(v) || 0 })}
              />
              <Field
                label="Prefijo numeración"
                value={billing.invoicePrefix}
                onChange={(v) => setBilling({ ...billing, invoicePrefix: v })}
              />
              <Field
                label="Próximo número"
                type="number"
                value={billing.nextInvoiceNumber.toString()}
                onChange={(v) => setBilling({ ...billing, nextInvoiceNumber: parseInt(v) || 0 })}
              />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Texto legal del aviso de pago</Label>
                <Textarea
                  rows={3}
                  value={billing.invoiceLegalText}
                  onChange={(e) => setBilling({ ...billing, invoiceLegalText: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Datos para transferencia bancaria</Label>
                <Textarea
                  rows={4}
                  value={billing.bankData}
                  onChange={(e) => setBilling({ ...billing, bankData: e.target.value })}
                />
              </div>
            </Grid>
            <SaveBar onSave={() => updateBilling.mutate(billing)} isLoading={updateBilling.isPending} />
          </SectionCard>
        </TabsContent>

        {/* HOSTING */}
        <TabsContent value="hosting">
          <SectionCard title="Hosting & HestiaCP">
            <Grid>
              <Field
                label="URL panel Hestia"
                value={hosting.hestiaUrl}
                onChange={(v) => setHosting({ ...hosting, hestiaUrl: v })}
                wide
              />
              <Field
                label="Servidor principal"
                value={hosting.mainServer}
                onChange={(v) => setHosting({ ...hosting, mainServer: v })}
              />
              <Field
                label="IP servidor"
                value={hosting.serverIp}
                onChange={(v) => setHosting({ ...hosting, serverIp: v })}
              />
              <Field
                label="Cuota por defecto (GB)"
                type="number"
                value={hosting.defaultQuotaGb.toString()}
                onChange={(v) => setHosting({ ...hosting, defaultQuotaGb: parseInt(v) || 0 })}
              />
              <Field
                label="Cuentas email por defecto"
                type="number"
                value={hosting.defaultEmails.toString()}
                onChange={(v) => setHosting({ ...hosting, defaultEmails: parseInt(v) || 0 })}
              />
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Alertas de espacio</p>
                  <p className="text-xs text-muted-foreground">Avisar cuando un servicio supere el 80% de su cuota</p>
                </div>
                <Switch
                  checked={hosting.spaceAlertsEnabled}
                  onCheckedChange={(v) => setHosting({ ...hosting, spaceAlertsEnabled: v })}
                />
              </div>
            </Grid>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={testHestiaConnection}>
                Probar conexión HestiaCP
              </Button>
            </div>
            <SaveBar onSave={() => updateHosting.mutate(hosting)} isLoading={updateHosting.isPending} />
          </SectionCard>
        </TabsContent>

        {/* PAGOS */}
        <TabsContent value="pagos">
          <SectionCard title="Métodos de pago">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">MercadoPago</p>
                  <p className="text-xs text-muted-foreground">Cobros con tarjeta, débito y dinero en cuenta</p>
                </div>
                <Switch
                  checked={payments.mercadoPagoEnabled}
                  onCheckedChange={(v) => setPayments({ ...payments, mercadoPagoEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">PayPal</p>
                  <p className="text-xs text-muted-foreground">Cobros internacionales en USD</p>
                </div>
                <Switch
                  checked={payments.paypalEnabled}
                  onCheckedChange={(v) => setPayments({ ...payments, paypalEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Transferencia bancaria</p>
                  <p className="text-xs text-muted-foreground">Conciliación manual desde Cobranza</p>
                </div>
                <Switch
                  checked={payments.bankTransferEnabled}
                  onCheckedChange={(v) => setPayments({ ...payments, bankTransferEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Efectivo / Manual</p>
                  <p className="text-xs text-muted-foreground">Registro manual de pagos</p>
                </div>
                <Switch
                  checked={payments.manualPaymentEnabled}
                  onCheckedChange={(v) => setPayments({ ...payments, manualPaymentEnabled: v })}
                />
              </div>
            </div>
            <SaveBar onSave={() => updatePayments.mutate(payments)} isLoading={updatePayments.isPending} />
          </SectionCard>
        </TabsContent>

        {/* EMAILS */}
        <TabsContent value="emails">
          <SectionCard
            title="Servidor SMTP"
            desc="Configuración real leída del servidor. Se edita en backend/.env y requiere reiniciar el servidor — no desde acá, por seguridad (mismo criterio que JWT, base de datos y MercadoPago)."
          >
            <Grid>
              <div className="space-y-1.5">
                <Label>SMTP host</Label>
                <Input value={emailData?.smtpHost ?? ""} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label>SMTP port</Label>
                <Input value={emailData?.smtpPort ?? ""} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Usuario</Label>
                <Input value={emailData?.smtpUser ?? ""} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Remitente</Label>
                <Input
                  value={emailData ? `${emailData.fromName} <${emailData.fromEmail}>` : ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Estado</p>
                  <p className="text-xs text-muted-foreground">
                    {emailData?.smtpConfigured
                      ? "Credenciales cargadas — el envío real depende de que sean correctas"
                      : "Faltan credenciales SMTP en .env — el envío de emails va a fallar"}
                  </p>
                </div>
                <Badge variant={emailData?.smtpConfigured ? "default" : "outline"}>
                  {emailData?.smtpConfigured ? "Configurado" : "Sin configurar"}
                </Badge>
              </div>
            </Grid>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={testEmailConfig}>
                Probar envío
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Las plantillas se editan en <a href="/plantillas" className="text-primary underline-offset-2 hover:underline">Plantillas</a>.
              Los recordatorios de WhatsApp se configuran en{" "}
              <Link to="/automatizaciones" className="text-primary underline-offset-2 hover:underline">
                Automatizaciones
              </Link>
              .
            </p>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
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
  value,
  onChange,
  type = "text",
  wide,
}: {
  label: string;
  value: string | number;
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
        Guardar
      </Button>
    </div>
  );
}
