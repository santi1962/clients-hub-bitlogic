/**
 * Bitlogic — Workflows operativos (modal wizards).
 * Cada workflow es un dialog multi-step que llama las APIs existentes.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateClient,
  useCreateService,
  useCreatePortalUser,
  useClients,
  usePlans,
  useServices,
  useCreateNotice,
  useCreatePayment,
  useSuspendService,
  useReactivateService,
  useChangeServicePlan,
} from "@/lib/queries";

// ─────────────────────────────────────────────────────────────
// Shared: Step indicator
// ─────────────────────────────────────────────────────────────
function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1 text-xs mb-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold " +
              (i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                ? "bg-primary/20 text-primary border border-primary"
                : "bg-muted text-muted-foreground")
            }
          >
            {i < current ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </span>
          <span className={i === current ? "text-foreground font-medium" : "text-muted-foreground"}>
            {s}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. NewClientWorkflow — Alta de cliente + servicio + portal
// ─────────────────────────────────────────────────────────────
export function NewClientWorkflow() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState("");

  const [clientData, setClientData] = useState({ name: "", company: "", email: "", phone: "" });
  const [serviceData, setServiceData] = useState({ planId: "", domain: "", monthlyPrice: "" });
  const [portalData, setPortalData] = useState({ password: "" });

  const createClient = useCreateClient();
  const createService = useCreateService();
  const createPortal = useCreatePortalUser();
  const { data: plans } = usePlans();

  const STEPS = ["Cliente", "Servicio", "Portal", "Listo"];

  const reset = () => {
    setStep(0);
    setClientId("");
    setClientData({ name: "", company: "", email: "", phone: "" });
    setServiceData({ planId: "", domain: "", monthlyPrice: "" });
    setPortalData({ password: "" });
  };

  const handleClose = () => { setOpen(false); reset(); };

  const stepOne = async () => {
    if (!clientData.name || !clientData.email) {
      toast.error("Nombre y email son requeridos");
      return;
    }
    try {
      const c = await createClient.mutateAsync(clientData);
      setClientId(c.id);
      setStep(1);
    } catch {}
  };

  const stepTwo = async () => {
    if (!serviceData.planId || !serviceData.domain) {
      toast.error("Plan y dominio son requeridos");
      return;
    }
    const selectedPlan = plans?.data.find((p) => p.id === serviceData.planId);
    const today = new Date().toISOString().slice(0, 10);
    const nextDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      await createService.mutateAsync({
        clientId,
        planId: serviceData.planId,
        domain: serviceData.domain,
        monthlyPrice: parseFloat(serviceData.monthlyPrice) || selectedPlan?.monthlyPrice,
        setupDate: today,
        nextDueDate,
      });
      setStep(2);
    } catch {}
  };

  const stepThree = async () => {
    if (!portalData.password || portalData.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    try {
      await createPortal.mutateAsync({
        clientId,
        name: clientData.name,
        email: clientData.email,
        password: portalData.password,
      });
      setStep(3);
    } catch {}
  };

  const isLoading = createClient.isPending || createService.isPending || createPortal.isPending;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Iniciar alta de cliente
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alta de cliente + hosting</DialogTitle>
            <DialogDescription>Onboarding completo en 4 pasos</DialogDescription>
          </DialogHeader>
          <Steps steps={STEPS} current={step} />

          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={clientData.name} onChange={(e) => setClientData((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <Input value={clientData.company} onChange={(e) => setClientData((p) => ({ ...p, company: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={clientData.email} onChange={(e) => setClientData((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={clientData.phone} onChange={(e) => setClientData((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={stepOne} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear cliente
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Plan *</Label>
                <Select value={serviceData.planId} onValueChange={(v) => setServiceData((p) => ({ ...p, planId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                  <SelectContent>
                    {plans?.data.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.name} — ${pl.monthlyPrice}/mes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dominio/Subdomain *</Label>
                <Input placeholder="ejemplo.com" value={serviceData.domain} onChange={(e) => setServiceData((p) => ({ ...p, domain: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Precio mensual (opcional — deja vacío para usar el del plan)</Label>
                <Input type="number" placeholder="0.00" value={serviceData.monthlyPrice} onChange={(e) => setServiceData((p) => ({ ...p, monthlyPrice: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>Atrás</Button>
                <Button onClick={stepTwo} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear servicio
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Se creará acceso al portal para <strong>{clientData.email}</strong>
              </p>
              <div className="space-y-1.5">
                <Label>Contraseña inicial *</Label>
                <Input type="password" value={portalData.password} onChange={(e) => setPortalData({ password: e.target.value })} />
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. El cliente deberá cambiarla.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Atrás</Button>
                <Button onClick={stepThree} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear acceso portal
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="font-semibold">¡Alta completada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cliente <strong>{clientData.name}</strong> creado con servicio y acceso al portal.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. GenerateNoticeWorkflow — Generar aviso de pago
// ─────────────────────────────────────────────────────────────
export function GenerateNoticeWorkflow() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: clientsData } = useClients({ limit: 200 });
  const { data: servicesData } = useServices({ clientId: clientId || undefined, limit: 100 });
  const createNotice = useCreateNotice();

  const clients = clientsData?.data ?? [];
  const services = servicesData?.data ?? [];

  const reset = () => {
    setClientId(""); setServiceId(""); setAmount(""); setDueDate("");
  };

  const handleSubmit = async () => {
    if (!clientId || !serviceId || !amount || !dueDate) {
      toast.error("Completá todos los campos");
      return;
    }
    const [periodYear, periodMonth] = period.split("-").map(Number);
    try {
      await createNotice.mutateAsync({
        clientId,
        hostingServiceId: serviceId,
        periodMonth,
        periodYear,
        amount: parseFloat(amount),
        dueDate,
      });
      toast.success("Aviso generado correctamente");
      setOpen(false);
      reset();
    } catch {}
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Generar aviso de pago
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar aviso de pago</DialogTitle>
            <DialogDescription>Seleccioná cliente y servicio para emitir el aviso</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setServiceId(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Servicio *</Label>
              <Select value={serviceId} onValueChange={setServiceId} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.domain} — {s.planName}</SelectItem>
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
                <Label>Importe *</Label>
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de vencimiento *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createNotice.isPending}>
                {createNotice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generar aviso
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. RegisterPaymentWorkflow — Registrar pago
// ─────────────────────────────────────────────────────────────
export function RegisterPaymentWorkflow() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("transfer");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: clientsData } = useClients({ limit: 200 });
  const createPayment = useCreatePayment();
  const clients = clientsData?.data ?? [];

  const reset = () => { setClientId(""); setAmount(""); setNotes(""); };

  const handleSubmit = async () => {
    if (!clientId || !amount) {
      toast.error("Cliente e importe son requeridos");
      return;
    }
    const paidDate = new Date(paidAt);
    try {
      await createPayment.mutateAsync({
        clientId,
        periodMonth: paidDate.getMonth() + 1,
        periodYear: paidDate.getFullYear(),
        amount: parseFloat(amount),
        method,
        paidAt,
        internalNotes: notes || undefined,
      });
      toast.success("Pago registrado");
      setOpen(false);
      reset();
    } catch {}
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago recibido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Importe *</Label>
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="manual">Manual / otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de pago</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Referencia de transferencia, etc." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createPayment.isPending}>
                {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar pago
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. SuspendServiceWorkflow — Suspender servicio
// ─────────────────────────────────────────────────────────────
export function SuspendServiceWorkflow() {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: servicesData } = useServices({ status: "activo", limit: 200 });
  const suspend = useSuspendService();
  const services = servicesData?.data ?? [];
  const selected = services.find((s) => s.id === serviceId);

  const reset = () => { setServiceId(""); setConfirmed(false); };

  const handleSubmit = async () => {
    if (!serviceId || !confirmed) { toast.error("Seleccioná un servicio y confirmá"); return; }
    try {
      await suspend.mutateAsync(serviceId);
      setOpen(false);
      reset();
    } catch {}
  };

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Suspender servicio
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Suspender servicio</DialogTitle>
            <DialogDescription>El servicio quedará en estado suspendido hasta reactivación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Servicio activo *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.domain} — {s.clientName ?? s.clientCompany}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Dominio:</span> {selected.domain}</p>
                <p><span className="text-muted-foreground">Cliente:</span> {selected.clientName}</p>
                <p><span className="text-muted-foreground">Plan:</span> {selected.planName}</p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Confirmo que deseo suspender este servicio
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={suspend.isPending || !confirmed}>
                {suspend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Suspender
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. ReactivateServiceWorkflow — Reactivar servicio
// ─────────────────────────────────────────────────────────────
export function ReactivateServiceWorkflow() {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");

  const { data: servicesData } = useServices({ status: "suspendido", limit: 200 });
  const reactivate = useReactivateService();
  const services = servicesData?.data ?? [];
  const selected = services.find((s) => s.id === serviceId);

  const reset = () => setServiceId("");

  const handleSubmit = async () => {
    if (!serviceId) { toast.error("Seleccioná un servicio"); return; }
    try {
      await reactivate.mutateAsync(serviceId);
      setOpen(false);
      reset();
    } catch {}
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reactivar servicio
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reactivar servicio suspendido</DialogTitle>
            <DialogDescription>El servicio volverá a estado activo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Servicio suspendido *</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {services.length === 0
                    ? <SelectItem value="none" disabled>No hay servicios suspendidos</SelectItem>
                    : services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.domain} — {s.clientName ?? s.clientCompany}</SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Dominio:</span> {selected.domain}</p>
                <p><span className="text-muted-foreground">Cliente:</span> {selected.clientName}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={reactivate.isPending || !serviceId}>
                {reactivate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reactivar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. ChangePlanWorkflow — Cambiar plan de un servicio
// ─────────────────────────────────────────────────────────────
export function ChangePlanWorkflow() {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [newPlanId, setNewPlanId] = useState("");

  const { data: servicesData } = useServices({ limit: 200 });
  const { data: plans } = usePlans();
  const changePlan = useChangeServicePlan();

  const services = servicesData?.data ?? [];
  const selected = services.find((s) => s.id === serviceId);
  const selectedPlan = plans?.data.find((p) => p.id === newPlanId);

  const reset = () => { setServiceId(""); setNewPlanId(""); };

  const handleSubmit = async () => {
    if (!serviceId || !newPlanId) { toast.error("Seleccioná servicio y plan"); return; }
    try {
      await changePlan.mutateAsync({ id: serviceId, planId: newPlanId });
      setOpen(false);
      reset();
    } catch {}
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Cambiar plan
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar plan de servicio</DialogTitle>
            <DialogDescription>Upgrade o downgrade del plan de hosting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Servicio *</Label>
              <Select value={serviceId} onValueChange={(v) => { setServiceId(v); setNewPlanId(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.domain} — {s.clientName ?? s.clientCompany} ({s.planName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">Plan actual: {selected.planName}</Badge>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nuevo plan *</Label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar nuevo plan" /></SelectTrigger>
                <SelectContent>
                  {plans?.data.filter((p) => p.id !== selected?.planId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ${p.monthlyPrice}/mes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && selectedPlan && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium">Resumen del cambio</p>
                <p><span className="text-muted-foreground">De:</span> {selected.planName} (${selected.monthlyPrice}/mes)</p>
                <p><span className="text-muted-foreground">A:</span> {selectedPlan.name} (${selectedPlan.monthlyPrice}/mes)</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={changePlan.isPending || !serviceId || !newPlanId}>
                {changePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar cambio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
