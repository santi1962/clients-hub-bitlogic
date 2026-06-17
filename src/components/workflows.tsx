/**
 * Bitlogic — Workflows operativos (modal wizards).
 *
 * Cada export es un componente cliente que renderiza su trigger
 * y maneja su propio Dialog interno con pasos. Todas las
 * mutaciones se hacen contra estado local + pushActivity(),
 * preparado para reemplazarse por llamadas reales a api-client.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  UserPlus,
  Server,
  FileText,
  Wallet,
  AlertTriangle,
  RotateCw,
  ArrowUpRight,
  CheckCircle2,
  Printer,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { pushActivity } from "@/lib/activity-log";
import { planRepository } from "@/lib/repositories";
import { formatMoney } from "@/lib/mock-data";
import {
  useClients,
  useClientServices,
  useCreateNotice,
  useCreatePayment,
  useServices,
  usePlans,
  useSuspendService,
  useReactivateService,
  useChangeServicePlan,
} from "@/lib/queries";
import { methodToDb } from "@/lib/api-mappers";

/* ============================================================
   shared helpers
============================================================ */
function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${i + 1 === step ? "w-6 bg-primary" : i + 1 < step ? "w-3 bg-primary/60" : "w-3 bg-muted"}`}
        />
      ))}
    </div>
  );
}
function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
async function fakeAwait(ms = 600) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ============================================================
   1. ALTA DE CLIENTE + HOSTING
============================================================ */
export function NewClientWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Paso 1
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");
  // Paso 2
  const [domain, setDomain] = useState("");
  const [planId, setPlanId] = useState("p-pro");
  const [monthlyPrice, setMonthlyPrice] = useState(18);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [hestiaUser, setHestiaUser] = useState("");
  const [hestiaUrl, setHestiaUrl] = useState("https://hestia.bitlogic.com.ar:8083");
  // Paso 3
  const [createNotice, setCreateNotice] = useState(true);
  const [sendAccess, setSendAccess] = useState(true);
  const [createTask, setCreateTask] = useState(true);
  const [initialStatus, setInitialStatus] = useState<"activo" | "pendiente">("pendiente");

  const plans = planRepository.findAll();
  const plan = plans.find((p) => p.id === planId);

  const s1Valid = name.trim() && email.trim();
  const s2Valid = domain.trim() && monthlyPrice > 0;

  const reset = () => {
    setStep(1);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setTaxId("");
    setNotes("");
    setDomain("");
    setHestiaUser("");
    setPlanId("p-pro");
    setMonthlyPrice(18);
    setCreateNotice(true);
    setSendAccess(true);
    setCreateTask(true);
    setInitialStatus("pendiente");
  };

  const submit = async () => {
    setLoading(true);
    try {
      await fakeAwait();
      const clientId = `c-${Math.random().toString(36).slice(2, 6)}`;
      const serviceId = `s-${Math.random().toString(36).slice(2, 6)}`;
      pushActivity({
        kind: "client_created",
        title: `Cliente ${name} registrado`,
        description: company,
        actor: "Vos",
        refs: { clientId },
      });
      pushActivity({
        kind: "service_created",
        title: `Servicio ${domain} creado (${plan?.name})`,
        actor: "Vos",
        refs: { clientId, serviceId, planId },
      });
      if (createNotice)
        pushActivity({
          kind: "payment_notice_created",
          title: `Aviso inicial — ${formatMoney(monthlyPrice)}`,
          description: `Vence ${dueDate}`,
          actor: "Vos",
          refs: { clientId, serviceId },
        });
      if (sendAccess)
        pushActivity({
          kind: "access_sent",
          title: "Acceso al portal enviado",
          description: email,
          actor: "Vos",
          refs: { clientId },
        });
      if (createTask)
        pushActivity({
          kind: "task_created",
          title: "Configuración inicial del hosting",
          description: `Servicio ${domain}`,
          actor: "Vos",
          refs: { clientId, serviceId },
        });
      toast.success("Cliente y servicio creados");
      setStep(4);
    } catch {
      toast.error("Error simulado al crear el cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Alta de cliente + hosting
        </Button>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alta de cliente + hosting</DialogTitle>
          <DialogDescription>Onboarding completo en 4 pasos.</DialogDescription>
          <div className="pt-2">
            <StepDots step={step} total={4} />
          </div>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Nombre *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Empresa</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>CUIT / DNI</Label>
              <Input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notas internas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Dominio principal *</Label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select
                value={planId}
                onValueChange={(v) => {
                  setPlanId(v);
                  const p = plans.find((pl) => pl.id === v);
                  if (p) setMonthlyPrice(p.monthlyPrice);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.monthlyPrice)}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Precio mensual (USD)</Label>
              <Input
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de alta</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Primer vencimiento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Usuario Hestia</Label>
              <Input
                value={hestiaUser}
                onChange={(e) => setHestiaUser(e.target.value)}
                placeholder="cliente01"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>URL Hestia</Label>
              <Input value={hestiaUrl} onChange={(e) => setHestiaUrl(e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {[
              {
                v: createNotice,
                set: setCreateNotice,
                label: "Crear aviso de pago inicial",
                desc: `Por ${formatMoney(monthlyPrice)} con vencimiento ${dueDate}`,
              },
              {
                v: sendAccess,
                set: setSendAccess,
                label: "Enviar accesos al cliente",
                desc: `Email a ${email || "(sin email)"}`,
              },
              {
                v: createTask,
                set: setCreateTask,
                label: "Crear tarea interna de configuración",
                desc: "Se asigna al equipo de soporte.",
              },
            ].map((o, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30"
              >
                <Checkbox checked={o.v} onCheckedChange={(c) => o.set(Boolean(c))} />
                <div>
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </div>
              </label>
            ))}
            <div>
              <Label className="mb-2 block">Estado inicial del servicio</Label>
              <RadioGroup
                value={initialStatus}
                onValueChange={(v) => setInitialStatus(v as any)}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { v: "pendiente", l: "Pendiente", d: "Esperando pago o configuración" },
                  { v: "activo", l: "Activo", d: "Listo y funcionando" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-3"
                  >
                    <RadioGroupItem value={o.v} className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">{o.l}</div>
                      <div className="text-xs text-muted-foreground">{o.d}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5" /> Onboarding completado correctamente.
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Resumen
              </div>
              <FieldRow label="Cliente" value={name} />
              <FieldRow label="Empresa" value={company || "—"} />
              <FieldRow label="Email" value={email} />
              <FieldRow label="Servicio" value={domain} />
              <FieldRow label="Plan" value={`${plan?.name} · ${formatMoney(monthlyPrice)}/mes`} />
              <FieldRow label="Estado" value={<Badge variant="secondary">{initialStatus}</Badge>} />
              <FieldRow label="Próx. vencimiento" value={dueDate} />
              <FieldRow label="Aviso emitido" value={createNotice ? "Sí" : "No"} />
              <FieldRow label="Acceso enviado" value={sendAccess ? "Sí" : "No"} />
              <FieldRow label="Tarea creada" value={createTask ? "Sí" : "No"} />
            </div>
          </div>
        )}

        <DialogFooter className="flex !justify-between gap-2">
          <div>
            {step > 1 && step < 4 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {step === 4 ? "Cerrar" : "Cancelar"}
            </Button>
            {step === 1 && (
              <Button disabled={!s1Valid} onClick={() => setStep(2)}>
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 2 && (
              <Button disabled={!s2Valid} onClick={() => setStep(3)}>
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={submit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…
                  </>
                ) : (
                  "Confirmar y crear"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   2. GENERAR AVISO DE PAGO
============================================================ */
export function GenerateNoticeWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [preview, setPreview] = useState(false);

  // Datos reales del backend
  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];
  const { data: servicesData } = useClientServices(clientId);
  const services = servicesData?.data ?? [];
  const service = services.find((s) => s.id === serviceId);
  const amount = service?.monthlyPrice ?? 0;
  const client = clients.find((c) => c.id === clientId);

  const createNoticeMutation = useCreateNotice();

  const reset = () => {
    setClientId("");
    setServiceId("");
    setPreview(false);
  };

  const confirm = () => {
    const [year, mon] = period.split("-").map(Number);
    createNoticeMutation.mutate(
      {
        clientId,
        hostingServiceId: serviceId,
        periodMonth: mon,
        periodYear: year,
        dueDate,
      },
      {
        onSuccess: (notice) => {
          pushActivity({
            kind: "payment_notice_created",
            title: `Aviso ${period} — ${formatMoney(amount)}`,
            description: `${service?.domain} · vence ${dueDate}`,
            actor: "Vos",
            refs: { clientId, serviceId },
          });
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <FileText className="mr-2 h-4 w-4" /> Generar aviso de pago
        </Button>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Generar aviso de pago</DialogTitle>
          <DialogDescription>Seleccioná el servicio y el período a facturar.</DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setServiceId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={clientId ? "Seleccionar servicio…" : "Elegí un cliente primero"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.domain} · {formatMoney(s.monthlyPrice)}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Período</Label>
                <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de vencimiento</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            {service && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                Monto calculado: <span className="font-semibold">{formatMoney(amount)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  (según precio del servicio)
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Aviso de pago
                </div>
                <div className="text-lg font-semibold">{service?.domain}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Bitlogic
                </div>
                <div className="text-xs text-muted-foreground">bitlogic.com.ar</div>
              </div>
            </div>
            <div className="grid gap-3 py-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Cliente</div>
                <div>{client?.name}</div>
                <div className="text-xs text-muted-foreground">{client?.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Período</div>
                <div>{period}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Vencimiento</div>
                <div>{dueDate}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Servicio</div>
                <div>{service?.domain}</div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-muted-foreground">Total a pagar</span>
              <span className="text-xl font-semibold">{formatMoney(amount)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="!justify-between gap-2">
          <div>
            {preview && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.message("Vista de impresión simulada")}
                >
                  <Printer className="mr-1 h-4 w-4" /> Imprimir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.message("PDF generado (placeholder)")}
                >
                  <Download className="mr-1 h-4 w-4" /> PDF
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {!preview ? (
              <Button disabled={!serviceId} onClick={() => setPreview(true)}>
                Vista previa
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPreview(false)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Editar
                </Button>
                <Button onClick={confirm} disabled={createNoticeMutation.isPending}>
                  {createNoticeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando…
                    </>
                  ) : (
                    "Confirmar y emitir"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   3. REGISTRAR PAGO
============================================================ */
export function RegisterPaymentWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Mercado Pago");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Datos reales del backend
  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];
  const { data: servicesData } = useClientServices(clientId);
  const services = servicesData?.data ?? [];
  const service = services.find((s) => s.id === serviceId);

  const createPaymentMutation = useCreatePayment();

  const reset = () => {
    setClientId("");
    setServiceId("");
    setAmount(0);
    setReference("");
    setNotes("");
  };

  const confirm = () => {
    const parts = paidAt.split("-");
    const periodYear = parseInt(parts[0]);
    const periodMonth = parseInt(parts[1]);
    createPaymentMutation.mutate(
      {
        clientId,
        hostingServiceId: serviceId,
        periodMonth,
        periodYear,
        amount,
        method: methodToDb(method),
        paidAt,
        reference: reference || undefined,
        internalNotes: notes || undefined,
      },
      {
        onSuccess: () => {
          pushActivity({
            kind: "payment_registered",
            title: `Pago recibido — ${formatMoney(amount)}`,
            description: `${service?.domain} · ${method}${reference ? ` · ref ${reference}` : ""}`,
            actor: "Vos",
            refs: { clientId, serviceId },
          });
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Wallet className="mr-2 h-4 w-4" /> Registrar pago
        </Button>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Registrá un pago recibido y actualizá el estado del aviso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setServiceId("");
                  setAmount(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio / Aviso</Label>
              <Select
                value={serviceId}
                onValueChange={(v) => {
                  setServiceId(v);
                  const s = services.find((s) => s.id === v);
                  if (s) setAmount(s.monthlyPrice);
                }}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Seleccionar…" : "Elegí un cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {serviceId && service && (
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
              Precio mensual del servicio:{" "}
              <span className="font-semibold text-foreground">
                {formatMoney(service.monthlyPrice)}
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Monto (USD)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Mercado Pago", "PayPal", "Transferencia", "Efectivo", "Tarjeta"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Referencia / comprobante</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas internas</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!serviceId || amount <= 0 || createPaymentMutation.isPending}
            onClick={confirm}
          >
            {createPaymentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando…
              </>
            ) : (
              "Confirmar pago"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   4. SUSPENDER / 5. REACTIVAR — comparten estructura
============================================================ */
function ServiceStateWorkflow({
  open,
  setOpen,
  mode,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  mode: "suspend" | "reactivate";
}) {
  const [serviceId, setServiceId] = useState("");
  const [reason, setReason] = useState("");

  const { data: allServicesData } = useServices();
  const allServices = allServicesData?.data ?? [];
  const services =
    mode === "suspend"
      ? allServices.filter((s) => s.status !== "suspendido" && s.status !== "cancelado")
      : allServices.filter((s) => s.status === "suspendido");
  const service = allServices.find((s) => s.id === serviceId);

  const suspendMutation = useSuspendService();
  const reactivateMutation = useReactivateService();
  const isPending = mode === "suspend" ? suspendMutation.isPending : reactivateMutation.isPending;

  const reset = () => {
    setServiceId("");
    setReason("");
  };

  const confirm = () => {
    const onSuccess = () => {
      if (mode === "suspend") {
        pushActivity({
          kind: "service_suspended",
          title: `Servicio ${service?.domain} suspendido`,
          description: reason || "Sin motivo especificado",
          actor: "Vos",
          refs: { clientId: service?.clientId, serviceId },
        });
        pushActivity({
          kind: "task_created",
          title: "Seguimiento de servicio suspendido",
          description: `Contactar al cliente de ${service?.domain}`,
          actor: "Sistema",
          refs: { clientId: service?.clientId, serviceId },
        });
      } else {
        pushActivity({
          kind: "service_reactivated",
          title: `Servicio ${service?.domain} reactivado`,
          description: reason || "Pago regularizado",
          actor: "Vos",
          refs: { clientId: service?.clientId, serviceId },
        });
      }
      setOpen(false);
      reset();
    };
    if (mode === "suspend") {
      suspendMutation.mutate(serviceId, { onSuccess });
    } else {
      reactivateMutation.mutate(serviceId, { onSuccess });
    }
  };

  const isSuspend = mode === "suspend";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isSuspend ? "Suspender servicio" : "Reactivar servicio"}</DialogTitle>
          <DialogDescription>
            {isSuspend
              ? "Esto deja al sitio inaccesible para el cliente."
              : "El servicio vuelve a estar operativo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Servicio</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar servicio…" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.domain} · {s.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSuspend && service && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Al suspender, <span className="font-semibold">{service.domain}</span> dejará de
                servir tráfico. El cliente seguirá viendo sus datos en el portal pero no podrá usar
                Hestia.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{isSuspend ? "Motivo de suspensión" : "Motivo de reactivación"}</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isSuspend
                  ? "Falta de pago, abuso, pedido del cliente…"
                  : "Pago regularizado, error corregido…"
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant={isSuspend ? "destructive" : "default"}
            disabled={!serviceId || isPending}
            onClick={confirm}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando…
              </>
            ) : isSuspend ? (
              "Confirmar suspensión"
            ) : (
              "Confirmar reactivación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function SuspendServiceWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Suspender servicio
        </Button>
      )}
      <ServiceStateWorkflow open={open} setOpen={setOpen} mode="suspend" />
    </>
  );
}
export function ReactivateServiceWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <RotateCw className="mr-2 h-4 w-4" /> Reactivar servicio
        </Button>
      )}
      <ServiceStateWorkflow open={open} setOpen={setOpen} mode="reactivate" />
    </>
  );
}

/* ============================================================
   6. CAMBIAR PLAN
============================================================ */
export function ChangePlanWorkflow({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [newPlanId, setNewPlanId] = useState("");
  const [applyDate, setApplyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [emitNotice, setEmitNotice] = useState(true);

  const { data: clientsData } = useClients();
  const clients = clientsData?.data ?? [];
  const { data: servicesData } = useClientServices(clientId);
  const services = servicesData?.data ?? [];
  const service = services.find((s) => s.id === serviceId);
  const { data: plansData } = usePlans();
  const allPlans = plansData?.data ?? [];
  const currentPlan = allPlans.find((p) => p.id === service?.planId);
  const plans = allPlans.filter((p) => p.id !== service?.planId);
  const newPlan = allPlans.find((p) => p.id === newPlanId);
  const diff = (newPlan?.monthlyPrice ?? 0) - (currentPlan?.monthlyPrice ?? 0);

  const changeServicePlanMutation = useChangeServicePlan();

  const reset = () => {
    setClientId("");
    setServiceId("");
    setNewPlanId("");
    setEmitNotice(true);
  };

  const confirm = () => {
    changeServicePlanMutation.mutate(
      { id: serviceId, planId: newPlanId },
      {
        onSuccess: () => {
          pushActivity({
            kind: "service_plan_changed",
            title: `Plan cambiado: ${currentPlan?.name} → ${newPlan?.name}`,
            description: `${service?.domain} · diferencia ${diff >= 0 ? "+" : ""}${formatMoney(diff)} · aplica ${applyDate}`,
            actor: "Vos",
            refs: { clientId, serviceId, planId: newPlanId },
          });
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <ArrowUpRight className="mr-2 h-4 w-4" /> Cambiar plan
        </Button>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cambiar plan</DialogTitle>
          <DialogDescription>
            Upgrade o downgrade del servicio. Calculamos la diferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setServiceId("");
                  setNewPlanId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select
                value={serviceId}
                onValueChange={(v) => {
                  setServiceId(v);
                  setNewPlanId("");
                }}
                disabled={!clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Seleccionar…" : "Elegí un cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {service && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Plan actual</div>
                <div className="text-sm font-semibold">{service.planName ?? currentPlan?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatMoney(currentPlan?.monthlyPrice ?? service.monthlyPrice)}/mes
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nuevo plan</Label>
                <Select value={newPlanId} onValueChange={setNewPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nuevo plan…" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.monthlyPrice)}/mes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {newPlan && (
            <div
              className={`rounded-lg border p-3 text-sm ${diff > 0 ? "border-amber-500/30 bg-amber-500/5 text-amber-200" : diff < 0 ? "border-sky-500/30 bg-sky-500/5 text-sky-200" : "border-border/60 bg-muted/30"}`}
            >
              Diferencia mensual:{" "}
              <span className="font-semibold">
                {diff >= 0 ? "+" : ""}
                {formatMoney(diff)}
              </span>
              {diff > 0
                ? " (upgrade — se cobra al cliente)"
                : diff < 0
                  ? " (downgrade — nota de crédito)"
                  : " (sin cambios de precio)"}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha de aplicación</Label>
              <Input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-1 text-sm">
              <Checkbox checked={emitNotice} onCheckedChange={(c) => setEmitNotice(Boolean(c))} />
              Emitir aviso/nota de ajuste automáticamente
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!newPlanId || changeServicePlanMutation.isPending} onClick={confirm}>
            {changeServicePlanMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando…
              </>
            ) : (
              "Confirmar cambio"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
