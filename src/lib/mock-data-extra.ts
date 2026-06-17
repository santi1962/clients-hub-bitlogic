// ============================================================
// Bitlogic — Mock data EXTRA (Dominios, Soporte, Tareas, Automations)
// ------------------------------------------------------------
// Esta capa contiene los modelos pensados para ser servidos
// posteriormente por un backend real (PostgreSQL + Node.js).
// Cada arreglo aquí simula una tabla y queda listo para
// reemplazarse por llamadas a la API REST/GraphQL.
//
// Integraciones futuras previstas:
//   - PostgreSQL          → fuente de verdad (tablas domains, tickets, tasks, automations)
//   - API Node.js         → endpoints REST/RPC (/api/domains, /api/tickets, ...)
//   - HestiaCP API        → sync de servicios y cuentas hosting
//   - MercadoPago / PayPal → estados de pagos (webhooks → tabla payments)
// ============================================================

import { clients, TODAY } from "./mock-data";

// ============================================================
// DOMINIOS
// ============================================================
export type DomainStatus = "activo" | "proximo_a_vencer" | "vencido" | "transferido";

export interface Domain {
  id: string;
  domain: string;
  clientId: string; // FK → clients.id
  registrar: string; // ej. "NIC.ar", "Namecheap", "GoDaddy"
  registeredAt: string; // ISO YYYY-MM-DD
  expiresAt: string; // ISO YYYY-MM-DD
  autoRenew: boolean;
  yearlyCost: number; // costo nuestro al registrador
  clientPrice: number; // precio cobrado al cliente
  status: DomainStatus;
  notes?: string;
}

export const domains: Domain[] = [
  {
    id: "d1",
    domain: "cafedelvalle.com",
    clientId: "c1",
    registrar: "Namecheap",
    registeredAt: "2022-02-15",
    expiresAt: "2027-02-15",
    autoRenew: true,
    yearlyCost: 12,
    clientPrice: 25,
    status: "activo",
  },
  {
    id: "d2",
    domain: "estudioacosta.com.ar",
    clientId: "c2",
    registrar: "NIC.ar",
    registeredAt: "2021-05-10",
    expiresAt: "2026-07-10",
    autoRenew: true,
    yearlyCost: 18,
    clientPrice: 30,
    status: "proximo_a_vencer",
  },
  {
    id: "d3",
    domain: "mundofit.com",
    clientId: "c3",
    registrar: "Namecheap",
    registeredAt: "2024-01-20",
    expiresAt: "2026-06-25",
    autoRenew: false,
    yearlyCost: 12,
    clientPrice: 25,
    status: "proximo_a_vencer",
  },
  {
    id: "d4",
    domain: "logisur.com",
    clientId: "c4",
    registrar: "GoDaddy",
    registeredAt: "2020-03-25",
    expiresAt: "2027-03-25",
    autoRenew: true,
    yearlyCost: 14,
    clientPrice: 28,
    status: "activo",
  },
  {
    id: "d5",
    domain: "belladermo.com",
    clientId: "c5",
    registrar: "Namecheap",
    registeredAt: "2023-06-12",
    expiresAt: "2026-06-22",
    autoRenew: true,
    yearlyCost: 12,
    clientPrice: 25,
    status: "proximo_a_vencer",
  },
  {
    id: "d6",
    domain: "luna-arquitectos.com",
    clientId: "c6",
    registrar: "Namecheap",
    registeredAt: "2024-09-20",
    expiresAt: "2026-09-20",
    autoRenew: true,
    yearlyCost: 12,
    clientPrice: 25,
    status: "activo",
  },
  {
    id: "d7",
    domain: "dentalplus.com",
    clientId: "c7",
    registrar: "GoDaddy",
    registeredAt: "2022-12-01",
    expiresAt: "2026-05-15",
    autoRenew: false,
    yearlyCost: 14,
    clientPrice: 28,
    status: "vencido",
  },
  {
    id: "d8",
    domain: "tiendamendez.com",
    clientId: "c8",
    registrar: "Namecheap",
    registeredAt: "2025-01-12",
    expiresAt: "2027-01-12",
    autoRenew: true,
    yearlyCost: 12,
    clientPrice: 25,
    status: "activo",
  },
  {
    id: "d9",
    domain: "cafedelvalle.com.ar",
    clientId: "c1",
    registrar: "NIC.ar",
    registeredAt: "2022-02-15",
    expiresAt: "2026-06-20",
    autoRenew: false,
    yearlyCost: 18,
    clientPrice: 30,
    status: "proximo_a_vencer",
  },
  {
    id: "d10",
    domain: "antiguomendez.com",
    clientId: "c8",
    registrar: "GoDaddy",
    registeredAt: "2021-05-04",
    expiresAt: "2026-05-04",
    autoRenew: false,
    yearlyCost: 14,
    clientPrice: 28,
    status: "transferido",
    notes: "Transferido a otro registrador a pedido del cliente.",
  },
];

// ============================================================
// TICKETS DE SOPORTE
// ============================================================
export type TicketPriority = "baja" | "normal" | "alta" | "urgente";
export type TicketStatus = "abierto" | "en_proceso" | "esperando_cliente" | "resuelto" | "cerrado";

export interface Ticket {
  id: string;
  number: string; // ej. "BL-1042"
  clientId: string; // FK
  subject: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export const tickets: Ticket[] = [
  {
    id: "t1",
    number: "BL-1042",
    clientId: "c1",
    subject: "No puedo acceder a mi correo @cafedelvalle.com",
    priority: "alta",
    status: "en_proceso",
    assignee: "Soporte L1",
    createdAt: "2026-06-14",
    updatedAt: "2026-06-15",
  },
  {
    id: "t2",
    number: "BL-1043",
    clientId: "c3",
    subject: "Subir certificado SSL personalizado",
    priority: "normal",
    status: "abierto",
    assignee: "Soporte L2",
    createdAt: "2026-06-15",
    updatedAt: "2026-06-15",
  },
  {
    id: "t3",
    number: "BL-1044",
    clientId: "c5",
    subject: "Reactivar blog suspendido",
    priority: "urgente",
    status: "abierto",
    assignee: "Admin",
    createdAt: "2026-06-16",
    updatedAt: "2026-06-16",
  },
  {
    id: "t4",
    number: "BL-1041",
    clientId: "c4",
    subject: "Migrar intranet a un VPS dedicado",
    priority: "alta",
    status: "esperando_cliente",
    assignee: "Soporte L2",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-13",
  },
  {
    id: "t5",
    number: "BL-1040",
    clientId: "c2",
    subject: "Cuota de espacio casi llena",
    priority: "normal",
    status: "resuelto",
    assignee: "Soporte L1",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-12",
  },
  {
    id: "t6",
    number: "BL-1039",
    clientId: "c6",
    subject: "Crear casilla info@luna-arquitectos.com",
    priority: "baja",
    status: "cerrado",
    assignee: "Soporte L1",
    createdAt: "2026-06-04",
    updatedAt: "2026-06-05",
  },
  {
    id: "t7",
    number: "BL-1045",
    clientId: "c8",
    subject: "Configurar redirección www → no-www",
    priority: "baja",
    status: "abierto",
    assignee: "Soporte L1",
    createdAt: "2026-06-16",
    updatedAt: "2026-06-16",
  },
];

// ============================================================
// TAREAS INTERNAS
// ============================================================
export type TaskPriority = TicketPriority;
export type TaskStatus = "pendiente" | "en_proceso" | "completada" | "cancelada";

export interface Task {
  id: string;
  title: string;
  description?: string;
  clientId?: string; // FK opcional
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  status: TaskStatus;
}

export const tasks: Task[] = [
  {
    id: "tk1",
    title: "Renovar dominio mundofit.com",
    description: "Renovar por 1 año en Namecheap.",
    clientId: "c3",
    priority: "alta",
    assignee: "Admin",
    dueDate: "2026-06-22",
    status: "pendiente",
  },
  {
    id: "tk2",
    title: "Migrar hosting Logisur a Business",
    description: "Coordinar ventana de migración.",
    clientId: "c4",
    priority: "normal",
    assignee: "Soporte L2",
    dueDate: "2026-06-25",
    status: "en_proceso",
  },
  {
    id: "tk3",
    title: "Actualizar sitio cafedelvalle.com",
    description: "Aplicar parches de WordPress + temas.",
    clientId: "c1",
    priority: "normal",
    assignee: "Soporte L1",
    dueDate: "2026-06-20",
    status: "pendiente",
  },
  {
    id: "tk4",
    title: "Crear correo info@luna-arquitectos.com",
    description: "10GB de cuota.",
    clientId: "c6",
    priority: "baja",
    assignee: "Soporte L1",
    dueDate: "2026-06-18",
    status: "completada",
  },
  {
    id: "tk5",
    title: "Resolver ticket BL-1044",
    description: "Cliente solicita reactivar blog.",
    clientId: "c5",
    priority: "urgente",
    assignee: "Admin",
    dueDate: "2026-06-17",
    status: "pendiente",
  },
  {
    id: "tk6",
    title: "Backup mensual de servidores",
    description: "Verificación de snapshots offsite.",
    priority: "normal",
    assignee: "Admin",
    dueDate: "2026-06-30",
    status: "pendiente",
  },
];

// ============================================================
// AUTOMATIZACIONES (reglas)
// ============================================================
export type AutomationTrigger = "antes_vencimiento" | "dia_vencimiento" | "despues_vencimiento";

export type AutomationChannel = "email" | "whatsapp" | "sms" | "interno";

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  offsetDays: number; // negativo = antes, 0 = el día, positivo = después
  channel: AutomationChannel;
  enabled: boolean;
  description: string;
  // Próximamente desde backend:
  // template_id, last_run_at, success_rate, etc.
}

export const automations: AutomationRule[] = [
  {
    id: "a1",
    name: "Recordatorio 15 días antes",
    trigger: "antes_vencimiento",
    offsetDays: -15,
    channel: "email",
    enabled: true,
    description: "Email automático 15 días antes del vencimiento del servicio.",
  },
  {
    id: "a2",
    name: "Recordatorio 7 días antes",
    trigger: "antes_vencimiento",
    offsetDays: -7,
    channel: "email",
    enabled: true,
    description: "Recordatorio cordial al cliente.",
  },
  {
    id: "a3",
    name: "Aviso 3 días antes",
    trigger: "antes_vencimiento",
    offsetDays: -3,
    channel: "whatsapp",
    enabled: false,
    description: "Mensaje por WhatsApp Business API.",
  },
  {
    id: "a4",
    name: "Aviso día de vencimiento",
    trigger: "dia_vencimiento",
    offsetDays: 0,
    channel: "email",
    enabled: true,
    description: "Email + aviso interno al equipo de cobranza.",
  },
  {
    id: "a5",
    name: "Reclamo 3 días vencido",
    trigger: "despues_vencimiento",
    offsetDays: 3,
    channel: "email",
    enabled: true,
    description: "Primer reclamo formal post-vencimiento.",
  },
  {
    id: "a6",
    name: "Suspensión 10 días vencido",
    trigger: "despues_vencimiento",
    offsetDays: 10,
    channel: "interno",
    enabled: false,
    description: "Genera tarea interna para suspender el servicio.",
  },
];

// ============================================================
// HELPERS / SELECTORS
// ============================================================
function parseLocalDate(d: string): Date {
  const [y, m, day] = d.split("T")[0].split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}
function daysFromToday(d: string) {
  const today = parseLocalDate(TODAY);
  const target = parseLocalDate(d);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export const getDomain = (id: string) => domains.find((d) => d.id === id);
export const clientDomains = (clientId: string) => domains.filter((d) => d.clientId === clientId);
export const clientTickets = (clientId: string) => tickets.filter((t) => t.clientId === clientId);

export function domainKpis() {
  const active = domains.filter(
    (d) => d.status === "activo" || d.status === "proximo_a_vencer",
  ).length;
  const dueIn30 = domains.filter((d) => {
    const diff = daysFromToday(d.expiresAt);
    return diff >= 0 && diff <= 30;
  }).length;
  const expired = domains.filter((d) => d.status === "vencido").length;
  const transferred = domains.filter((d) => d.status === "transferido").length;
  return { active, dueIn30, expired, transferred };
}

export function ticketKpis() {
  return {
    open: tickets.filter((t) => t.status === "abierto").length,
    inProgress: tickets.filter((t) => t.status === "en_proceso").length,
    waiting: tickets.filter((t) => t.status === "esperando_cliente").length,
    resolved: tickets.filter((t) => t.status === "resuelto" || t.status === "cerrado").length,
    urgent: tickets.filter(
      (t) => t.priority === "urgente" && t.status !== "cerrado" && t.status !== "resuelto",
    ).length,
  };
}

export function taskKpis() {
  return {
    pending: tasks.filter((t) => t.status === "pendiente").length,
    inProgress: tasks.filter((t) => t.status === "en_proceso").length,
    completed: tasks.filter((t) => t.status === "completada").length,
    overdue: tasks.filter(
      (t) => t.status !== "completada" && t.status !== "cancelada" && daysFromToday(t.dueDate) < 0,
    ).length,
  };
}

// Helper para etiquetar prioridad/canal
export const priorityLabel: Record<TicketPriority, string> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};
export const priorityColor: Record<TicketPriority, string> = {
  baja: "bg-muted text-muted-foreground border-border",
  normal: "bg-info/15 text-info border-info/30",
  alta: "bg-warning/15 text-warning border-warning/30",
  urgente: "bg-destructive/15 text-destructive border-destructive/40",
};

// Re-export útil para sanity check de relaciones
export const _meta = {
  totalDomains: domains.length,
  totalTickets: tickets.length,
  totalTasks: tasks.length,
  totalClients: clients.length,
};
