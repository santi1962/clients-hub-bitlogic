import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Users,
  Server,
  Globe,
  Wallet,
  FileText,
  LifeBuoy,
  ListChecks,
  Workflow,
  Shield,
  Activity,
  Send,
  Cable,
  Zap,
  KeyRound,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_admin/arquitectura")({
  head: () => ({ meta: [{ title: "Arquitectura Backend — Bitlogic" }] }),
  component: ArchitecturePage,
});

// ============================================================
// Documentación visual de la arquitectura backend objetivo.
// Fuente de verdad para el equipo durante la migración a:
//   Node.js + Express + PostgreSQL + HestiaCP + MercadoPago + PayPal.
// ============================================================

interface Entity {
  table: string;
  label: string;
  icon: any;
  description: string;
  fields: string[];
  relations: string[];
  states?: string[];
}

const ENTITIES: Entity[] = [
  {
    table: "users",
    label: "Usuarios internos y clientes",
    icon: Users,
    description:
      "Cuentas con acceso al sistema (staff y clientes con portal). Autenticación por email + password (hash bcrypt/argon2).",
    fields: [
      "id (uuid)",
      "email (unique)",
      "password_hash",
      "name",
      "phone",
      "role",
      "status",
      "last_login_at",
      "created_at",
    ],
    relations: ["1—1 client (cuando role = cliente)", "1—N audit_logs", "1—N notification_logs"],
    states: ["activo", "inactivo", "invitado"],
  },
  {
    table: "clients",
    label: "Clientes",
    icon: Users,
    description: "Empresa o persona que contrata servicios. Datos de facturación y contacto.",
    fields: [
      "id",
      "name",
      "email",
      "phone",
      "company",
      "tax_id",
      "address",
      "status",
      "notes",
      "created_at",
    ],
    relations: [
      "1—N hosting_services",
      "1—N domains",
      "1—N support_tickets",
      "1—N payments",
      "1—N payment_notices",
    ],
    states: ["activo", "inactivo"],
  },
  {
    table: "hosting_plans",
    label: "Planes de hosting",
    icon: Database,
    description: "Catálogo de planes (Starter, Pro, Business). Precio base, recursos incluidos.",
    fields: ["id", "name", "storage_gb", "sites", "email_accounts", "monthly_price", "active"],
    relations: ["1—N hosting_services"],
  },
  {
    table: "hosting_services",
    label: "Servicios de hosting",
    icon: Server,
    description:
      "Instancia de hosting contratada por un cliente. Asociada a un usuario de HestiaCP.",
    fields: [
      "id",
      "client_id",
      "plan_id",
      "domain",
      "status",
      "start_date",
      "next_due_date",
      "monthly_price",
      "hestia_user",
      "hestia_url",
      "used_gb",
      "total_gb",
      "used_emails",
      "total_emails",
      "notes",
    ],
    relations: [
      "N—1 clients",
      "N—1 hosting_plans",
      "1—N payments",
      "1—N payment_notices",
      "1—N internal_tasks",
    ],
    states: ["activo", "proximo_a_vencer", "pendiente", "suspendido", "cancelado", "vencido"],
  },
  {
    table: "domains",
    label: "Dominios",
    icon: Globe,
    description:
      "Dominios administrados (compra/renovación). Pueden o no estar vinculados a un servicio hosting.",
    fields: [
      "id",
      "domain",
      "client_id",
      "registrar",
      "registered_at",
      "expires_at",
      "auto_renew",
      "yearly_cost",
      "client_price",
      "status",
      "notes",
    ],
    relations: ["N—1 clients", "1—N internal_tasks"],
    states: ["activo", "proximo_a_vencer", "vencido", "transferido"],
  },
  {
    table: "payments",
    label: "Pagos",
    icon: Wallet,
    description:
      "Cobros efectuados por servicios u otros conceptos. Pueden originarse manualmente o por webhook (MP/PayPal).",
    fields: [
      "id",
      "client_id",
      "service_id",
      "period_month",
      "amount",
      "method",
      "external_id",
      "paid_at",
      "status",
      "created_at",
    ],
    relations: ["N—1 clients", "N—1 hosting_services", "1—1 payment_notice (opcional)"],
    states: ["pagado", "pendiente", "vencido"],
  },
  {
    table: "payment_notices",
    label: "Avisos de pago",
    icon: FileText,
    description:
      "Documento emitido al cliente con el detalle del cobro. Puede generar PDF y notificación por email.",
    fields: [
      "id",
      "client_id",
      "service_id",
      "period",
      "amount",
      "issued_at",
      "due_at",
      "pdf_url",
      "status",
    ],
    relations: ["N—1 clients", "N—1 hosting_services"],
    states: ["emitido", "pagado", "vencido"],
  },
  {
    table: "support_tickets",
    label: "Tickets de soporte",
    icon: LifeBuoy,
    description: "Solicitudes de soporte abiertas por clientes o staff.",
    fields: [
      "id",
      "number",
      "client_id",
      "subject",
      "priority",
      "status",
      "assigned_to (user_id)",
      "created_at",
      "updated_at",
    ],
    relations: ["N—1 clients", "1—N support_ticket_messages", "1—N internal_tasks"],
    states: ["abierto", "en_proceso", "esperando_cliente", "resuelto", "cerrado"],
  },
  {
    table: "support_ticket_messages",
    label: "Mensajes de tickets",
    icon: Send,
    description: "Hilo de conversación dentro de un ticket. Soporta adjuntos.",
    fields: [
      "id",
      "ticket_id",
      "author_id (user_id)",
      "author_role",
      "body",
      "attachments (jsonb)",
      "created_at",
    ],
    relations: ["N—1 support_tickets", "N—1 users"],
  },
  {
    table: "internal_tasks",
    label: "Tareas internas",
    icon: ListChecks,
    description:
      "Workflow operativo del equipo (migraciones, renovaciones, contactos). Puede vincularse polimórficamente.",
    fields: [
      "id",
      "title",
      "description",
      "assignee_id",
      "priority",
      "status",
      "due_date",
      "client_id?",
      "service_id?",
      "domain_id?",
      "ticket_id?",
      "created_at",
    ],
    relations: [
      "N—1 users (assignee)",
      "0/1 → clients | hosting_services | domains | support_tickets",
    ],
    states: ["pendiente", "en_proceso", "completada", "cancelada"],
  },
  {
    table: "automation_rules",
    label: "Reglas de automatización",
    icon: Workflow,
    description:
      "Triggers (días antes/después de vencimiento, monto > X, etc.) que disparan notificaciones.",
    fields: ["id", "name", "trigger", "offset_days", "channel", "template", "active", "created_at"],
    relations: ["1—N notification_logs (registro de ejecuciones)"],
  },
  {
    table: "audit_logs",
    label: "Auditoría",
    icon: Shield,
    description:
      "Registro inmutable de acciones sensibles (cambios de plan, suspensiones, eliminaciones, accesos admin).",
    fields: [
      "id",
      "user_id",
      "action",
      "entity_type",
      "entity_id",
      "diff (jsonb)",
      "ip",
      "user_agent",
      "created_at",
    ],
    relations: ["N—1 users"],
  },
  {
    table: "notification_logs",
    label: "Notificaciones enviadas",
    icon: Activity,
    description: "Histórico de notificaciones (email, WhatsApp, SMS, push) con estado de entrega.",
    fields: [
      "id",
      "user_id?",
      "client_id?",
      "channel",
      "template",
      "payload (jsonb)",
      "status",
      "provider_id",
      "sent_at",
    ],
    relations: ["N—1 users (opcional)", "N—1 clients (opcional)"],
  },
];

const RELATIONS: { from: string; to: string; cardinality: string; desc: string }[] = [
  {
    from: "clients",
    to: "hosting_services",
    cardinality: "1 — N",
    desc: "Un cliente puede tener múltiples servicios de hosting.",
  },
  {
    from: "clients",
    to: "domains",
    cardinality: "1 — N",
    desc: "Un cliente puede tener múltiples dominios.",
  },
  {
    from: "clients",
    to: "support_tickets",
    cardinality: "1 — N",
    desc: "Un cliente puede abrir múltiples tickets.",
  },
  {
    from: "hosting_services",
    to: "clients",
    cardinality: "N — 1",
    desc: "Cada servicio pertenece a un cliente.",
  },
  {
    from: "hosting_services",
    to: "hosting_plans",
    cardinality: "N — 1",
    desc: "Cada servicio usa un plan.",
  },
  {
    from: "hosting_services",
    to: "payments",
    cardinality: "1 — N",
    desc: "Un servicio puede tener múltiples pagos.",
  },
  {
    from: "hosting_services",
    to: "payment_notices",
    cardinality: "1 — N",
    desc: "Un servicio puede generar múltiples avisos de pago.",
  },
  {
    from: "support_tickets",
    to: "support_ticket_messages",
    cardinality: "1 — N",
    desc: "Un ticket puede tener múltiples mensajes.",
  },
  {
    from: "internal_tasks",
    to: "clients | services | domains | tickets",
    cardinality: "0/1 polimórfica",
    desc: "Una tarea puede asociarse opcionalmente a cualquiera de estas entidades.",
  },
];

type Endpoint = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; desc: string };
const ENDPOINTS: { group: string; icon: any; items: Endpoint[] }[] = [
  {
    group: "Auth",
    icon: KeyRound,
    items: [
      {
        method: "POST",
        path: "/api/auth/login",
        desc: "Email + password → access token + refresh cookie",
      },
      { method: "POST", path: "/api/auth/logout", desc: "Invalida refresh + access" },
      {
        method: "POST",
        path: "/api/auth/refresh",
        desc: "Renueva access token desde refresh cookie",
      },
      { method: "POST", path: "/api/auth/forgot-password", desc: "Envía email con token" },
      {
        method: "POST",
        path: "/api/auth/reset-password",
        desc: "Cambia password con token válido",
      },
      { method: "GET", path: "/api/auth/me", desc: "Usuario actual + claims" },
    ],
  },
  {
    group: "Clients",
    icon: Users,
    items: [
      { method: "GET", path: "/api/clients", desc: "Listado con filtros + paginación" },
      { method: "POST", path: "/api/clients", desc: "Crear cliente" },
      { method: "GET", path: "/api/clients/:id", desc: "Detalle + servicios" },
      { method: "PATCH", path: "/api/clients/:id", desc: "Actualizar parcial" },
      { method: "DELETE", path: "/api/clients/:id", desc: "Soft delete" },
    ],
  },
  {
    group: "Hosting Services",
    icon: Server,
    items: [
      {
        method: "GET",
        path: "/api/hosting/services",
        desc: "Listado con filtros (status, plan, cliente)",
      },
      { method: "POST", path: "/api/hosting/services", desc: "Alta + provisión HestiaCP" },
      { method: "GET", path: "/api/hosting/services/:id", desc: "Detalle + métricas de uso" },
      { method: "PATCH", path: "/api/hosting/services/:id", desc: "Editar metadata / fechas" },
      { method: "POST", path: "/api/hosting/services/:id/suspend", desc: "Suspende vía HestiaCP" },
      {
        method: "POST",
        path: "/api/hosting/services/:id/reactivate",
        desc: "Reactiva vía HestiaCP",
      },
      {
        method: "POST",
        path: "/api/hosting/services/:id/change-plan",
        desc: "Cambia plan + recalcula",
      },
    ],
  },
  {
    group: "Plans",
    icon: Database,
    items: [
      { method: "GET", path: "/api/hosting/plans", desc: "Catálogo de planes" },
      { method: "POST", path: "/api/hosting/plans", desc: "Crear plan" },
      { method: "PATCH", path: "/api/hosting/plans/:id", desc: "Editar precio / recursos" },
    ],
  },
  {
    group: "Domains",
    icon: Globe,
    items: [
      { method: "GET", path: "/api/domains", desc: "Listado con filtros" },
      { method: "POST", path: "/api/domains", desc: "Registrar dominio" },
      { method: "GET", path: "/api/domains/:id", desc: "Detalle" },
      { method: "PATCH", path: "/api/domains/:id", desc: "Editar (autoRenew, costos, estado)" },
    ],
  },
  {
    group: "Payments",
    icon: Wallet,
    items: [
      {
        method: "GET",
        path: "/api/payments",
        desc: "Listado + filtros (estado, cliente, servicio)",
      },
      { method: "POST", path: "/api/payments", desc: "Crear pago manual" },
      { method: "GET", path: "/api/payments/:id", desc: "Detalle + comprobante" },
      { method: "PATCH", path: "/api/payments/:id", desc: "Actualizar campos" },
      { method: "POST", path: "/api/payments/:id/mark-paid", desc: "Marcar como pagado (admin)" },
    ],
  },
  {
    group: "Payment Notices",
    icon: FileText,
    items: [
      { method: "GET", path: "/api/payment-notices", desc: "Listado de avisos emitidos" },
      {
        method: "POST",
        path: "/api/payment-notices",
        desc: "Emitir aviso (un servicio + período)",
      },
      { method: "GET", path: "/api/payment-notices/:id", desc: "Detalle" },
      { method: "POST", path: "/api/payment-notices/:id/send", desc: "Enviar por email" },
      { method: "POST", path: "/api/payment-notices/:id/pdf", desc: "Generar PDF (S3/local)" },
    ],
  },
  {
    group: "Support",
    icon: LifeBuoy,
    items: [
      { method: "GET", path: "/api/support/tickets", desc: "Listado con filtros" },
      { method: "POST", path: "/api/support/tickets", desc: "Crear ticket" },
      { method: "GET", path: "/api/support/tickets/:id", desc: "Detalle + mensajes" },
      {
        method: "PATCH",
        path: "/api/support/tickets/:id",
        desc: "Cambiar estado/prioridad/asignación",
      },
      {
        method: "POST",
        path: "/api/support/tickets/:id/messages",
        desc: "Agregar mensaje (con attachments)",
      },
    ],
  },
  {
    group: "Tasks",
    icon: ListChecks,
    items: [
      { method: "GET", path: "/api/tasks", desc: "Listado por filtros (assignee, status)" },
      { method: "POST", path: "/api/tasks", desc: "Crear tarea" },
      { method: "PATCH", path: "/api/tasks/:id", desc: "Actualizar" },
      { method: "POST", path: "/api/tasks/:id/complete", desc: "Marcar completada" },
    ],
  },
  {
    group: "Operations / Dashboard",
    icon: Zap,
    items: [
      {
        method: "GET",
        path: "/api/operations/summary",
        desc: "Tickets urgentes + dominios por vencer + pagos pendientes + tareas",
      },
      { method: "GET", path: "/api/dashboard/admin", desc: "KPIs panel admin" },
      { method: "GET", path: "/api/dashboard/client", desc: "KPIs portal cliente" },
    ],
  },
];

interface Integration {
  name: string;
  icon: any;
  color: string;
  items: string[];
}
const INTEGRATIONS: Integration[] = [
  {
    name: "HestiaCP",
    icon: Server,
    color: "text-emerald-300",
    items: [
      "Crear usuario",
      "Suspender usuario",
      "Reactivar usuario",
      "Consultar uso de disco",
      "Consultar cuentas de correo",
      "Consultar dominios",
    ],
  },
  {
    name: "MercadoPago",
    icon: Wallet,
    color: "text-sky-300",
    items: [
      "Crear preferencia de pago (init_point)",
      "Recibir webhook (idempotente + verificación de firma)",
      "Marcar pago como pagado y vincular a payments.id",
    ],
  },
  {
    name: "PayPal",
    icon: Wallet,
    color: "text-amber-300",
    items: [
      "Crear checkout (orden + captura)",
      "Recibir webhook (verificación transmission-sig)",
      "Marcar pago como pagado y conciliar",
    ],
  },
  {
    name: "Email (Resend / SES)",
    icon: Send,
    color: "text-violet-300",
    items: [
      "Enviar aviso de pago",
      "Enviar recordatorio de vencimiento",
      "Enviar respuesta de ticket",
    ],
  },
  {
    name: "WhatsApp (futuro)",
    icon: Cable,
    color: "text-emerald-300",
    items: ["Recordatorios manuales", "Automatizaciones (Twilio / WhatsApp Cloud API)"],
  },
];

// ------------------------------------------------------------
function MethodBadge({ m }: { m: Endpoint["method"] }) {
  const colors: Record<Endpoint["method"], string> = {
    GET: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    POST: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PATCH: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    DELETE: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex w-16 justify-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${colors[m]}`}
    >
      {m}
    </span>
  );
}

function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arquitectura Backend</h1>
        <p className="text-sm text-muted-foreground">
          Documentación viva de las entidades, relaciones, endpoints e integraciones del backend
          objetivo. Esta es la fuente de verdad durante la migración del frontend mock a Node.js +
          PostgreSQL.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Frontend", v: "TanStack Start · React 19", icon: Zap },
          { label: "API", v: "Node.js + Express · REST", icon: Server },
          { label: "Base de datos", v: "PostgreSQL 16 + Prisma/Knex", icon: Database },
          { label: "Auth", v: "JWT (15m) + Refresh httpOnly", icon: KeyRound },
        ].map((b) => (
          <Card key={b.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <b.icon className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {b.label}
                </div>
                <div className="text-sm font-medium">{b.v}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="entidades">
        <TabsList>
          <TabsTrigger value="entidades">Entidades</TabsTrigger>
          <TabsTrigger value="relaciones">Relaciones</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          <TabsTrigger value="stack">Stack &amp; flujo</TabsTrigger>
        </TabsList>

        {/* ===================== ENTIDADES ===================== */}
        <TabsContent value="entidades" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ENTITIES.map((e) => (
              <Card key={e.table} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <e.icon className="h-4 w-4 text-primary" /> {e.label}
                    </CardTitle>
                    <code className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                      {e.table}
                    </code>
                  </div>
                  <CardDescription>{e.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Campos
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.fields.map((f) => (
                        <code
                          key={f}
                          className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono"
                        >
                          {f}
                        </code>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Relaciones
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {e.relations.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                  {e.states && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Estados
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.states.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===================== RELACIONES ===================== */}
        <TabsContent value="relaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diagrama lógico</CardTitle>
              <CardDescription>
                Representación compacta de las cardinalidades entre tablas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg border border-border/60 bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
                {`
      ┌──────────┐        ┌────────────────┐        ┌───────────────┐
      │ clients  │ 1 ── N │ hosting_servs. │ N ── 1 │ hosting_plans │
      └────┬─────┘        └───────┬────────┘        └───────────────┘
       1 │                       │ 1
         │ N                     │ N
         ▼                       ▼
      ┌──────────┐         ┌──────────────────┐
      │ domains  │         │ payments         │
      └──────────┘         └──────────────────┘
                                │ 1
                                │ N
                                ▼
                           ┌──────────────────┐
                           │ payment_notices  │
                           └──────────────────┘

   ┌────────────────┐ 1 ── N ┌────────────────────────┐
   │ support_tickets│        │ support_ticket_messages│
   └───────┬────────┘        └────────────────────────┘
           │ 0/1 polimórfica
           ▼
   ┌────────────────┐
   │ internal_tasks │  ───►  client | service | domain | ticket
   └────────────────┘
`}
              </pre>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {RELATIONS.map((r, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-4">
                  <code className="rounded-md bg-primary/10 px-2 py-1 text-xs font-mono text-primary">
                    {r.from}
                  </code>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <code className="rounded-md bg-primary/10 px-2 py-1 text-xs font-mono text-primary">
                    {r.to}
                  </code>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {r.cardinality}
                  </Badge>
                  <div className="basis-full text-xs text-muted-foreground">{r.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===================== ENDPOINTS ===================== */}
        <TabsContent value="endpoints" className="space-y-4">
          {ENDPOINTS.map((g) => (
            <Card key={g.group}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <g.icon className="h-4 w-4 text-primary" /> {g.group}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {g.items.map((e) => (
                  <div
                    key={e.method + e.path}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <MethodBadge m={e.method} />
                    <code className="text-xs font-mono">{e.path}</code>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{e.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ===================== INTEGRACIONES ===================== */}
        <TabsContent value="integraciones" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.map((i) => (
              <Card key={i.name}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 text-base ${i.color}`}>
                    <i.icon className="h-4 w-4" /> {i.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {i.items.map((it) => (
                      <li key={it}>• {it}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variables de entorno (server-only)</CardTitle>
              <CardDescription>
                Se cargarán como secrets en el backend, jamás expuestas al frontend.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {[
                "DATABASE_URL",
                "JWT_ACCESS_SECRET",
                "JWT_REFRESH_SECRET",
                "HESTIA_API_URL",
                "HESTIA_API_KEY",
                "MP_ACCESS_TOKEN",
                "MP_WEBHOOK_SECRET",
                "PAYPAL_CLIENT_ID",
                "PAYPAL_SECRET",
                "PAYPAL_WEBHOOK_ID",
                "RESEND_API_KEY",
                "EMAIL_FROM",
                "TWILIO_SID",
                "TWILIO_TOKEN",
              ].map((k) => (
                <code
                  key={k}
                  className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-mono"
                >
                  {k}
                </code>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== STACK ===================== */}
        <TabsContent value="stack" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flujo de datos</CardTitle>
              <CardDescription>
                Cómo viaja una request desde el navegador hasta la base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg border border-border/60 bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
                {`
  Browser (React + TanStack)
        │
        ▼
  src/lib/api-client.ts     ←─ centraliza fetch, JWT, refresh, errores
        │  HTTPS + Bearer
        ▼
  Node.js + Express
   ├─ middleware: cors, helmet, rate-limit, validate (zod), auth (JWT)
   ├─ controllers → services → repositories
   └─ integrations: HestiaCP · MercadoPago · PayPal · Email · WhatsApp
        │
        ▼
  PostgreSQL (Prisma o Knex)
        │
        ▼
  Jobs:
   • node-cron  → renovación dominios, avisos automáticos
   • workers    → procesar webhooks de pago de forma idempotente
`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capa frontend conectada al backend real</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <code className="rounded-md bg-muted/50 px-1.5 py-0.5 text-xs">
                  src/lib/api-client.ts
                </code>{" "}
                expone los namespaces <code>authApi</code>, <code>clientsApi</code>,{" "}
                <code>hostingApi</code>, <code>plansApi</code>,<code> domainsApi</code>,{" "}
                <code>paymentsApi</code>, <code>noticesApi</code>, <code>supportApi</code>,
                <code> tasksApi</code> y <code>dashboardApi</code>.
              </p>
              <p>
                Cada función llama a <code>request(...)</code> contra el backend Express real
                (definido en <code>VITE_API_BASE_URL</code>), con manejo de refresh de token JWT
                incluido. No quedan repositorios ni datos mock en el frontend.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
