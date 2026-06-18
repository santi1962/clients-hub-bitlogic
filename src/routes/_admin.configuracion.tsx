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
import { Building2, FileText, Server, Wallet, Mail, MessageCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { emailApi, hestiaApi } from "@/lib/api-client";
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
  useUpdateEmailSettings,
  useWhatsappSettings,
  useUpdateWhatsappSettings,
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

  // Email
  const { data: emailData } = useEmailSettings();
  const updateEmail = useUpdateEmailSettings();
  const [email, setEmail] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    fromName: "",
    fromEmail: "",
  });

  // WhatsApp
  const { data: whatsappData } = useWhatsappSettings();
  const updateWhatsapp = useUpdateWhatsappSettings();
  const [whatsapp, setWhatsapp] = useState({
    contactNumber: "",
    defaultMessage: "",
    enabled: false,
  });

  // Load data into form when API responds
  useEffect(() => {
    if (companyData) setCompany(companyData);
  }, [companyData]);

  useEffect(() => {
    if (billingData) setBilling(billingData);
  }, [billingData]);

  useEffect(() => {
    if (hostingData) setHosting(hostingData);
  }, [hostingData]);

  useEffect(() => {
    if (paymentsData) setPayments(paymentsData);
  }, [paymentsData]);

  useEffect(() => {
    if (emailData) setEmail(emailData);
  }, [emailData]);

  useEffect(() => {
    if (whatsappData) setWhatsapp(whatsappData);
  }, [whatsappData]);

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
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">B</div>
                  <Button variant="outline" size="sm" onClick={() => toast.info("Subir logo (placeholder)")}>
                    Cambiar logo
                  </Button>
                </div>
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
          <SectionCard title="Servidor SMTP">
            <Grid>
              <Field
                label="SMTP host"
                value={email.smtpHost}
                onChange={(v) => setEmail({ ...email, smtpHost: v })}
              />
              <Field
                label="SMTP port"
                type="number"
                value={email.smtpPort.toString()}
                onChange={(v) => setEmail({ ...email, smtpPort: parseInt(v) || 587 })}
              />
              <Field
                label="Usuario"
                value={email.smtpUser}
                onChange={(v) => setEmail({ ...email, smtpUser: v })}
              />
              <Field
                label="Contraseña"
                type="password"
                value={email.smtpPassword}
                onChange={(v) => setEmail({ ...email, smtpPassword: v })}
              />
              <Field
                label="Remitente (Name)"
                value={email.fromName}
                onChange={(v) => setEmail({ ...email, fromName: v })}
              />
              <Field
                label="Remitente (Email)"
                type="email"
                value={email.fromEmail}
                onChange={(v) => setEmail({ ...email, fromEmail: v })}
              />
            </Grid>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={testEmailConfig}>
                Probar envío
              </Button>
            </div>
            <SaveBar onSave={() => updateEmail.mutate(email)} isLoading={updateEmail.isPending} />
            <p className="text-xs text-muted-foreground pt-2">
              Las plantillas se editan en <a href="/plantillas" className="text-primary underline-offset-2 hover:underline">Plantillas</a>.
            </p>
          </SectionCard>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp">
          <SectionCard title="WhatsApp">
            <Grid>
              <Field
                label="Número de contacto"
                value={whatsapp.contactNumber}
                onChange={(v) => setWhatsapp({ ...whatsapp, contactNumber: v })}
              />
              <div className="md:col-span-2 space-y-1.5">
                <Label>Mensaje predeterminado</Label>
                <Textarea
                  rows={3}
                  value={whatsapp.defaultMessage}
                  onChange={(e) => setWhatsapp({ ...whatsapp, defaultMessage: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-dashed border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Integración WhatsApp Business</p>
                  <p className="text-xs text-muted-foreground">Requiere cuenta verificada Meta</p>
                </div>
                <Switch checked={whatsapp.enabled} onCheckedChange={(v) => setWhatsapp({ ...whatsapp, enabled: v })} />
              </div>
            </Grid>
            <SaveBar onSave={() => updateWhatsapp.mutate(whatsapp)} isLoading={updateWhatsapp.isPending} />
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
