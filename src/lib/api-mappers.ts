/**
 * Mappers entre formato del backend (inglés, snake_case) y el frontend (español, camelCase).
 *
 * El backend almacena: active, inactive, due_soon, pending_payment, overdue, suspended, cancelled
 * El frontend usa:     activo, inactivo, proximo_a_vencer, pendiente, vencido, suspendido, cancelado
 *
 * La conversión se hace en api-client.ts antes de entregar los datos a los hooks/páginas.
 */
import type { Client, HostingService, Plan, ClientStatus, ServiceStatus } from "./types";

// ─────────────────────────────────────────────────────────────
// Status maps
// ─────────────────────────────────────────────────────────────
const CLIENT_STATUS_FROM_DB: Record<string, ClientStatus> = {
  active: "activo",
  inactive: "inactivo",
};

const SERVICE_STATUS_FROM_DB: Record<string, ServiceStatus> = {
  active: "activo",
  due_soon: "proximo_a_vencer",
  pending_payment: "pendiente",
  overdue: "vencido",
  suspended: "suspendido",
  cancelled: "cancelado",
};

// Frontend → DB (para query params de filtro)
const CLIENT_STATUS_TO_DB: Record<string, string> = {
  activo: "active",
  inactivo: "inactive",
};

const SERVICE_STATUS_TO_DB: Record<string, string> = {
  activo: "active",
  proximo_a_vencer: "due_soon",
  pendiente: "pending_payment",
  vencido: "overdue",
  suspendido: "suspended",
  cancelado: "cancelled",
};

export const clientStatusFromDb = (s: string): ClientStatus => CLIENT_STATUS_FROM_DB[s] ?? "activo";

export const serviceStatusFromDb = (s: string): ServiceStatus =>
  SERVICE_STATUS_FROM_DB[s] ?? "activo";

export const clientStatusToDb = (s: string): string => CLIENT_STATUS_TO_DB[s] ?? s;

export const serviceStatusToDb = (s: string): string => SERVICE_STATUS_TO_DB[s] ?? s;

// ─────────────────────────────────────────────────────────────
// Backend API response shapes (antes de mapear)
// ─────────────────────────────────────────────────────────────
export interface BackendClient {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  taxId: string | null;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  servicesCount: number;
  nextDueDate: string | null;
  lastPaymentDate: string | null;
}

export interface BackendPlan {
  id: string;
  name: string;
  description: string | null;
  storageGb: number;
  websitesLimit: number | null;
  emailsLimit: number | null;
  monthlyPrice: number;
  status: string;
}

export interface BackendService {
  id: string;
  clientId: string;
  planId: string;
  domain: string;
  status: string;
  monthlyPrice: number;
  setupDate: string;
  nextDueDate: string;
  storageUsedGb: number;
  storageTotalGb: number;
  emailsUsed: number;
  emailsTotal: number | null;
  hestiaUsername: string | null;
  hestiaUrl: string | null;
  internalNotes: string;
  clientName?: string;
  clientCompany?: string;
  planName?: string;
}

// ─────────────────────────────────────────────────────────────
// Mappers: backend → frontend
// ─────────────────────────────────────────────────────────────

/** Tipo extendido de HostingService con campos join del backend */
export type HostingServiceFull = HostingService & {
  clientName?: string;
  clientCompany?: string;
  planName?: string;
  nextDueDate: string;
};

export function mapClient(
  raw: BackendClient,
): Client & { servicesCount: number; nextDueDate: string | null; lastPaymentDate: string | null } {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone ?? "",
    company: raw.company ?? "",
    status: clientStatusFromDb(raw.status),
    notes: raw.notes ?? "",
    createdAt: raw.createdAt?.split("T")[0] ?? "",
    servicesCount: raw.servicesCount ?? 0,
    nextDueDate: raw.nextDueDate ?? null,
    lastPaymentDate: raw.lastPaymentDate ?? null,
  };
}

export function mapPlan(raw: BackendPlan): Plan {
  return {
    id: raw.id,
    name: raw.name,
    storageGB: raw.storageGb,
    sites: raw.websitesLimit ?? "ilimitados",
    emails: raw.emailsLimit ?? "ilimitados",
    monthlyPrice: parseFloat(String(raw.monthlyPrice)),
  };
}

export function mapService(raw: BackendService): HostingServiceFull {
  return {
    id: raw.id,
    clientId: raw.clientId,
    domain: raw.domain,
    planId: raw.planId,
    status: serviceStatusFromDb(raw.status),
    usedGB: raw.storageUsedGb ?? 0,
    totalGB: raw.storageTotalGb,
    usedEmails: raw.emailsUsed ?? 0,
    totalEmails: raw.emailsTotal ?? "ilimitados",
    startDate: raw.setupDate,
    nextDueDate: raw.nextDueDate,
    monthlyPrice: parseFloat(String(raw.monthlyPrice)),
    hestiaUser: raw.hestiaUsername ?? "",
    hestiaUrl: raw.hestiaUrl ?? "",
    notes: raw.internalNotes ?? "",
    // Joined fields
    clientName: raw.clientName ?? undefined,
    clientCompany: raw.clientCompany ?? undefined,
    planName: raw.planName ?? undefined,
  };
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Payment + Notice status/method maps
// ─────────────────────────────────────────────────────────────
const PAYMENT_STATUS_FROM_DB: Record<string, string> = {
  pending: "pendiente",
  paid: "pagado",
  overdue: "vencido",
  cancelled: "cancelado",
};

const NOTICE_STATUS_FROM_DB: Record<string, string> = {
  draft: "borrador",
  pending: "pendiente",
  sent: "enviado",
  paid: "pagado",
  overdue: "vencido",
  cancelled: "cancelado",
};

const METHOD_FROM_DB: Record<string, string> = {
  manual: "Manual",
  transfer: "Transferencia",
  cash: "Efectivo",
  mercadopago: "MercadoPago",
  paypal: "PayPal",
};

const PAYMENT_STATUS_TO_DB: Record<string, string> = {
  pendiente: "pending",
  pagado: "paid",
  vencido: "overdue",
  cancelado: "cancelled",
};

const NOTICE_STATUS_TO_DB: Record<string, string> = {
  borrador: "draft",
  pendiente: "pending",
  enviado: "sent",
  pagado: "paid",
  vencido: "overdue",
  cancelado: "cancelled",
};

const METHOD_TO_DB: Record<string, string> = {
  Manual: "manual",
  Transferencia: "transfer",
  Efectivo: "cash",
  MercadoPago: "mercadopago",
  "Mercado Pago": "mercadopago",
  PayPal: "paypal",
};

export const paymentStatusFromDb = (s: string) => PAYMENT_STATUS_FROM_DB[s] ?? s;
export const noticeStatusFromDb = (s: string) => NOTICE_STATUS_FROM_DB[s] ?? s;
export const methodFromDb = (s: string) => METHOD_FROM_DB[s] ?? s;
export const paymentStatusToDb = (s: string) => PAYMENT_STATUS_TO_DB[s] ?? s;
export const noticeStatusToDb = (s: string) => NOTICE_STATUS_TO_DB[s] ?? s;
export const methodToDb = (s: string) => METHOD_TO_DB[s] ?? s;

// ─────────────────────────────────────────────────────────────
// Backend API response shapes — billing
// ─────────────────────────────────────────────────────────────
export interface BackendPayment {
  id: string;
  clientId: string;
  hostingServiceId: string | null;
  paymentNoticeId: string | null;
  periodMonth: number;
  periodYear: number;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  reference: string | null;
  internalNotes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  serviceDomain: string | null;
  noticeNumber: string | null;
  createdAt: string;
}

export interface BackendNotice {
  id: string;
  clientId: string;
  hostingServiceId: string;
  noticeNumber: string;
  periodMonth: number;
  periodYear: number;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
  notes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceDomain: string | null;
  planName: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Tipos mapeados — billing (compatibles con las páginas existentes)
// ─────────────────────────────────────────────────────────────

/** Formato compatible con los componentes existentes (period como "2026-06") */
export interface MappedPayment {
  id: string;
  clientId: string;
  serviceId: string; // hostingServiceId mapeado a serviceId
  periodMonth: string; // "2026-06" para formatPeriod()
  amount: number;
  method: string; // Español: "Transferencia", etc.
  paidAt: string | null; // YYYY-MM-DD
  status: string; // Español: "pagado", etc.
  reference: string | null;
  internalNotes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  serviceDomain: string | null;
  noticeNumber: string | null;
}

export interface MappedNotice {
  id: string;
  clientId: string;
  serviceId: string; // hostingServiceId
  noticeNumber: string;
  period: string; // "2026-06" para formatPeriod()
  issuedAt: string; // issueDate → compatibilidad con código existente
  dueAt: string; // dueDate
  amount: number;
  status: string; // Español
  sentAt: string | null;
  paidAt: string | null;
  notes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  serviceDomain: string | null;
  planName: string | null;
}

function periodString(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function mapPayment(raw: BackendPayment): MappedPayment {
  return {
    id: raw.id,
    clientId: raw.clientId,
    serviceId: raw.hostingServiceId ?? "",
    periodMonth: periodString(raw.periodMonth, raw.periodYear),
    amount: parseFloat(String(raw.amount)),
    method: methodFromDb(raw.method),
    paidAt: raw.paidAt?.split("T")[0] ?? null,
    status: paymentStatusFromDb(raw.status),
    reference: raw.reference,
    internalNotes: raw.internalNotes,
    clientName: raw.clientName,
    clientCompany: raw.clientCompany,
    serviceDomain: raw.serviceDomain,
    noticeNumber: raw.noticeNumber,
  };
}

export function mapNotice(raw: BackendNotice): MappedNotice {
  return {
    id: raw.id,
    clientId: raw.clientId,
    serviceId: raw.hostingServiceId,
    noticeNumber: raw.noticeNumber,
    period: periodString(raw.periodMonth, raw.periodYear),
    issuedAt: raw.issueDate,
    dueAt: raw.dueDate,
    amount: parseFloat(String(raw.amount)),
    status: noticeStatusFromDb(raw.status),
    sentAt: raw.sentAt,
    paidAt: raw.paidAt,
    notes: raw.notes,
    clientName: raw.clientName,
    clientCompany: raw.clientCompany,
    clientEmail: raw.clientEmail,
    clientPhone: raw.clientPhone,
    serviceDomain: raw.serviceDomain,
    planName: raw.planName,
  };
}

// ─────────────────────────────────────────────────────────────
// Domains (Phase 3A)
// ─────────────────────────────────────────────────────────────

const DOMAIN_STATUS_FROM_DB: Record<string, string> = {
  active: "activo",
  due_soon: "proximo_a_vencer",
  expired: "vencido",
  transferred: "transferido",
  cancelled: "cancelado",
};

const DOMAIN_STATUS_TO_DB: Record<string, string> = {
  activo: "active",
  proximo_a_vencer: "due_soon",
  vencido: "expired",
  transferido: "transferred",
  cancelado: "cancelled",
};

export const domainStatusFromDb = (s: string): string => DOMAIN_STATUS_FROM_DB[s] ?? "activo";

export const domainStatusToDb = (s: string): string => DOMAIN_STATUS_TO_DB[s] ?? s;

export interface BackendDomain {
  id: string;
  clientId: string;
  hostingServiceId: string | null;
  domain: string;
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string;
  autoRenew: boolean;
  annualCost: number | null;
  customerPrice: number | null;
  status: string;
  notes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  serviceDomain: string | null;
  planName: string | null;
  createdAt: string;
}

export interface MappedDomain {
  id: string;
  clientId: string;
  serviceId: string | null;
  domain: string;
  registrar: string | null;
  expirationDate: string;
  autoRenew: boolean;
  annualCost: number | null;
  customerPrice: number | null;
  status: string;
  notes: string | null;
  clientName: string | null;
  clientCompany: string | null;
  serviceDomain: string | null;
  planName: string | null;
}

export function mapDomain(raw: BackendDomain): MappedDomain {
  return {
    id: raw.id,
    clientId: raw.clientId,
    serviceId: raw.hostingServiceId,
    domain: raw.domain,
    registrar: raw.registrar,
    expirationDate: raw.expirationDate,
    autoRenew: raw.autoRenew,
    annualCost: raw.annualCost,
    customerPrice: raw.customerPrice,
    status: domainStatusFromDb(raw.status),
    notes: raw.notes,
    clientName: raw.clientName,
    clientCompany: raw.clientCompany,
    serviceDomain: raw.serviceDomain,
    planName: raw.planName,
  };
}

// ─────────────────────────────────────────────────────────────
// Support Tickets (Phase 3B)
// ─────────────────────────────────────────────────────────────

const TICKET_STATUS_FROM_DB: Record<string, string> = {
  open: "abierto",
  in_progress: "en_progreso",
  waiting_client: "esperando_cliente",
  resolved: "resuelto",
  closed: "cerrado",
};

const TICKET_PRIORITY_FROM_DB: Record<string, string> = {
  low: "baja",
  normal: "normal",
  high: "alta",
  urgent: "urgente",
};

const TICKET_STATUS_TO_DB: Record<string, string> = {
  abierto: "open",
  en_progreso: "in_progress",
  esperando_cliente: "waiting_client",
  resuelto: "resolved",
  cerrado: "closed",
};

const TICKET_PRIORITY_TO_DB: Record<string, string> = {
  baja: "low",
  normal: "normal",
  alta: "high",
  urgente: "urgent",
};

export const ticketStatusFromDb = (s: string): string => TICKET_STATUS_FROM_DB[s] ?? "abierto";

export const ticketPriorityFromDb = (s: string): string => TICKET_PRIORITY_FROM_DB[s] ?? "normal";

export const ticketStatusToDb = (s: string): string => TICKET_STATUS_TO_DB[s] ?? s;

export const ticketPriorityToDb = (s: string): string => TICKET_PRIORITY_TO_DB[s] ?? s;

export interface BackendTicket {
  id: string;
  ticket_number: string;
  client_id: string;
  hosting_service_id: string | null;
  subject: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  last_message_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_company?: string;
  service_domain?: string;
  assigned_user_name?: string;
}

export interface MappedTicket {
  id: string;
  ticketNumber: string;
  clientId: string;
  serviceId: string | null;
  subject: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdBy: string | null;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  clientCompany?: string;
  serviceDomain?: string;
  assignedUserName?: string;
}

export function mapTicket(raw: BackendTicket): MappedTicket {
  return {
    id: raw.id,
    ticketNumber: raw.ticket_number,
    clientId: raw.client_id,
    serviceId: raw.hosting_service_id,
    subject: raw.subject,
    priority: ticketPriorityFromDb(raw.priority),
    status: ticketStatusFromDb(raw.status),
    assignedTo: raw.assigned_to,
    createdBy: raw.created_by,
    lastMessageAt: raw.last_message_at,
    resolvedAt: raw.resolved_at,
    closedAt: raw.closed_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    clientName: raw.client_name,
    clientCompany: raw.client_company,
    serviceDomain: raw.service_domain,
    assignedUserName: raw.assigned_user_name,
  };
}

// ─────────────────────────────────────────────────────────────
// Internal Tasks (Phase 3C)
// ─────────────────────────────────────────────────────────────

const TASK_STATUS_FROM_DB: Record<string, string> = {
  pending: "pendiente",
  in_progress: "en_proceso",
  completed: "completada",
  cancelled: "cancelada",
};

const TASK_PRIORITY_FROM_DB: Record<string, string> = {
  low: "baja",
  normal: "normal",
  high: "alta",
  urgent: "urgente",
};

const TASK_STATUS_TO_DB: Record<string, string> = {
  pendiente: "pending",
  en_proceso: "in_progress",
  completada: "completed",
  cancelada: "cancelled",
};

const TASK_PRIORITY_TO_DB: Record<string, string> = {
  baja: "low",
  normal: "normal",
  alta: "high",
  urgente: "urgent",
};

export const taskStatusFromDb = (s: string): string => TASK_STATUS_FROM_DB[s] ?? "pendiente";

export const taskPriorityFromDb = (s: string): string => TASK_PRIORITY_FROM_DB[s] ?? "normal";

export const taskStatusToDb = (s: string): string => TASK_STATUS_TO_DB[s] ?? s;

export const taskPriorityToDb = (s: string): string => TASK_PRIORITY_TO_DB[s] ?? s;

export interface BackendTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  client_id: string | null;
  hosting_service_id: string | null;
  domain_id: string | null;
  support_ticket_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_company?: string;
  service_domain?: string;
  domain_name?: string;
  ticket_number?: string;
  assigned_user_name?: string;
}

export interface MappedTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdBy: string | null;
  clientId: string | null;
  serviceId: string | null;
  domainId: string | null;
  ticketId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  clientCompany?: string;
  serviceDomain?: string;
  domainName?: string;
  ticketNumber?: string;
  assignedUserName?: string;
}

export function mapTask(raw: BackendTask): MappedTask {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: taskStatusFromDb(raw.status),
    priority: taskPriorityFromDb(raw.priority),
    assignedTo: raw.assigned_to,
    createdBy: raw.created_by,
    clientId: raw.client_id,
    serviceId: raw.hosting_service_id,
    domainId: raw.domain_id,
    ticketId: raw.support_ticket_id,
    dueDate: raw.due_date,
    completedAt: raw.completed_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    clientName: raw.client_name,
    clientCompany: raw.client_company,
    serviceDomain: raw.service_domain,
    domainName: raw.domain_name,
    ticketNumber: raw.ticket_number,
    assignedUserName: raw.assigned_user_name,
  };
}
