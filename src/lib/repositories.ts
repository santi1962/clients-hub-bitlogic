/**
 * ============================================================
 * Bitlogic — Repositorios MOCK
 * ------------------------------------------------------------
 * Cada repositorio simula la interfaz de un DAO contra PostgreSQL.
 * Cuando se conecte el backend real, estos repositorios serán
 * reemplazados por llamadas reales desde `src/lib/api-client.ts`.
 *
 * Convenciones:
 *   findAll(filters?)   → SELECT * FROM tabla WHERE ...
 *   findById(id)        → SELECT * FROM tabla WHERE id = $1 LIMIT 1
 *   findByClient(id)    → JOIN clients
 *
 * No mutar los arrays exportados — usar copias si se simula creación.
 * ============================================================
 */
import {
  clients,
  services,
  plans,
  payments,
  notices,
  type Client,
  type HostingService,
  type Plan,
  type Payment,
  type PaymentNotice,
} from "./mock-data";
import {
  domains,
  tickets,
  tasks,
  automations,
  type Domain,
  type Ticket,
  type Task,
  type AutomationRule,
} from "./mock-data-extra";

/** Mensaje de un ticket — tabla `support_ticket_messages` (mock vacío por ahora). */
export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorRole: "cliente" | "soporte" | "admin";
  body: string;
  createdAt: string;
}
const ticketMessages: TicketMessage[] = [];

// ------------------- CLIENTS -------------------
export const clientRepository = {
  findAll: (): Client[] => clients,
  findById: (id: string): Client | undefined => clients.find((c) => c.id === id),
};

// ------------------- HOSTING SERVICES -------------------
export const hostingRepository = {
  findAll: (): HostingService[] => services,
  findById: (id: string): HostingService | undefined => services.find((s) => s.id === id),
  findByClient: (clientId: string): HostingService[] =>
    services.filter((s) => s.clientId === clientId),
  findByPlan: (planId: string): HostingService[] => services.filter((s) => s.planId === planId),
};

// ------------------- PLANS -------------------
export const planRepository = {
  findAll: (): Plan[] => plans,
  findById: (id: string): Plan | undefined => plans.find((p) => p.id === id),
};

// ------------------- PAYMENTS -------------------
export const paymentRepository = {
  findAll: (filters?: { status?: string; clientId?: string; serviceId?: string }): Payment[] => {
    let r = payments;
    if (filters?.status) r = r.filter((p) => p.status === filters.status);
    if (filters?.clientId) r = r.filter((p) => p.clientId === filters.clientId);
    if (filters?.serviceId) r = r.filter((p) => p.serviceId === filters.serviceId);
    return r;
  },
  findById: (id: string): Payment | undefined => payments.find((p) => p.id === id),
  findByClient: (clientId: string): Payment[] => payments.filter((p) => p.clientId === clientId),
  findByService: (serviceId: string): Payment[] =>
    payments.filter((p) => p.serviceId === serviceId),
};

// ------------------- PAYMENT NOTICES -------------------
export const paymentNoticeRepository = {
  findAll: (): PaymentNotice[] => notices,
  findById: (id: string): PaymentNotice | undefined => notices.find((n) => n.id === id),
  findByClient: (clientId: string): PaymentNotice[] =>
    notices.filter((n) => n.clientId === clientId),
};

// ------------------- DOMAINS -------------------
export const domainRepository = {
  findAll: (): Domain[] => domains,
  findById: (id: string): Domain | undefined => domains.find((d) => d.id === id),
  findByClient: (clientId: string): Domain[] => domains.filter((d) => d.clientId === clientId),
};

// ------------------- SUPPORT (tickets + messages) -------------------
export const supportRepository = {
  findAllTickets: (): Ticket[] => tickets,
  findTicketById: (id: string): Ticket | undefined => tickets.find((t) => t.id === id),
  findTicketsByClient: (clientId: string): Ticket[] =>
    tickets.filter((t) => t.clientId === clientId),
  findMessagesByTicket: (ticketId: string): TicketMessage[] =>
    ticketMessages.filter((m) => m.ticketId === ticketId),
};

// ------------------- TASKS -------------------
export const taskRepository = {
  findAll: (): Task[] => tasks,
  findById: (id: string): Task | undefined => tasks.find((t) => t.id === id),
  findOpen: (): Task[] => tasks.filter((t) => t.status !== "completada"),
};

// ------------------- AUTOMATIONS -------------------
export const automationRepository = {
  findAll: (): AutomationRule[] => automations,
  findById: (id: string): AutomationRule | undefined => automations.find((r) => r.id === id),
};
