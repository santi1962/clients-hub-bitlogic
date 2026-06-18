/**
 * ============================================================
 * Bitlogic — API Client (FRONTEND ↔ BACKEND BRIDGE)
 * ------------------------------------------------------------
 * Esta capa centraliza TODAS las llamadas al backend futuro.
 *
 * Arquitectura objetivo:
 *   Frontend (React/TanStack) ─► api-client.ts ─► Node.js + Express ─► PostgreSQL
 *                                              └► HestiaCP API
 *                                              └► MercadoPago / PayPal (webhooks)
 *                                              └► Email / WhatsApp providers
 *
 * Convenciones:
 *   - Todas las funciones devuelven Promises tipadas.
 *   - Auth: el `accessToken` (JWT, 15min) viaja en header Authorization.
 *   - Refresh token: cookie httpOnly Secure SameSite=strict (no se toca acá).
 *   - Errores: el backend devolverá `{ error: { code, message } }` con status 4xx/5xx.
 *
 * MIENTRAS NO HAYA BACKEND: cada función está implementada con un mock
 * que lee de los repositorios locales (src/lib/repositories.ts) y simula
 * latencia. Reemplazar el cuerpo por `request(...)` cuando esté el backend.
 * ============================================================
 */

import type { Client, HostingService, Plan, Payment, PaymentNotice } from "./mock-data";
import type { Domain, Ticket, Task, AutomationRule } from "./mock-data-extra";
import {
  clientRepository,
  hostingRepository,
  planRepository,
  paymentRepository,
  paymentNoticeRepository,
  domainRepository,
  supportRepository,
  taskRepository,
  automationRepository,
  type TicketMessage,
} from "./repositories";

// ------------------------------------------------------------
// Config + helper HTTP (preparado para activar cuando exista backend)
// ------------------------------------------------------------
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"; // ej. https://api.bitlogic.com.ar

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** @internal Evita el interceptor de 401 para rutas de auth (previene loops infinitos). */
  _skipRefresh?: boolean;
}

// Lock: si hay múltiples requests que reciben 401 simultáneamente,
// solo se hace UNA llamada a /auth/refresh. Todas las demás esperan la misma promesa.
let _refreshingPromise: Promise<string> | null = null;

export async function request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method: opts.method ?? "GET",
      credentials: "include", // envía la refresh cookie httpOnly
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

  let res = await doFetch();

  // ── Refresh automático ────────────────────────────────────────
  // Si el servidor devuelve 401 y no estamos ya en una ruta de auth,
  // intentamos renovar el access token con la refresh cookie y
  // reintentamos la request original una sola vez.
  if (res.status === 401 && !opts._skipRefresh) {
    try {
      if (!_refreshingPromise) {
        _refreshingPromise = request<{ accessToken: string }>("/auth/refresh", {
          method: "POST",
          _skipRefresh: true, // evitar loop: si /refresh da 401, lanzar directo
        })
          .then(({ accessToken: newToken }) => {
            setAccessToken(newToken);
            return newToken;
          })
          .finally(() => {
            _refreshingPromise = null;
          });
      }
      await _refreshingPromise; // esperar que el refresh (ya en curso) termine
      res = await doFetch(); // reintentar con el nuevo token en memoria
    } catch {
      // Refresh falló → sesión terminada
      setAccessToken(null);
      window.location.href = "/login";
      throw new Error("Sesión expirada");
    }
  }
  // ─────────────────────────────────────────────────────────────

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// Pequeño helper para simular IO mientras estemos en modo mock.
const mock = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((r) => setTimeout(() => r(value), ms));

// ============================================================
// AUTH
// ============================================================
export interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}
export interface AuthSession {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
    clientId: string | null;
    lastLoginAt: string | null;
  };
}

export const authApi = {
  /** POST /api/auth/login → { accessToken, user } + sets refresh cookie httpOnly */
  async login(payload: LoginPayload): Promise<AuthSession> {
    // _skipRefresh: un 401 en login significa credenciales inválidas, no token expirado
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: payload,
      _skipRefresh: true,
    });
  },
  /** POST /api/auth/logout → 204 + borra cookie */
  async logout(): Promise<void> {
    // _skipRefresh: si logout falla con 401, igual limpiamos sesión (ver auth.tsx)
    await request("/auth/logout", { method: "POST", _skipRefresh: true });
    setAccessToken(null);
  },
  /** POST /api/auth/refresh (cookie httpOnly) → { accessToken } */
  async refresh(): Promise<{ accessToken: string }> {
    // _skipRefresh: el refresh no debe intentar refrescarse a sí mismo
    return request<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      _skipRefresh: true,
    });
  },
  /** POST /api/auth/forgot-password { email } */
  async forgotPassword(email: string): Promise<void> {
    await request("/auth/forgot-password", { method: "POST", body: { email }, _skipRefresh: true });
  },
  /** POST /api/auth/reset-password { token, password } */
  async resetPassword(token: string, password: string): Promise<void> {
    await request("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      _skipRefresh: true,
    });
  },
  /** GET /api/auth/me — requiere Bearer token (sí usa el interceptor de refresh) */
  async me(): Promise<AuthSession["user"]> {
    return request<AuthSession["user"]>("/auth/me");
  },
};

// ============================================================
// CLIENTS  —  conectado al backend real
// ============================================================
import {
  mapClient,
  mapPlan,
  mapService,
  clientStatusToDb,
  serviceStatusToDb,
  type BackendClient,
  type BackendPlan,
  type BackendService,
  type ListMeta,
} from "./api-mappers";

export interface ClientListFilters {
  search?: string;
  status?: string; // valores en español: 'activo' | 'inactivo'
  page?: number;
  limit?: number;
}

export interface ServiceListFilters {
  clientId?: string;
  planId?: string;
  search?: string;
  status?: string; // valores en español
  page?: number;
  limit?: number;
}

type ListResponse<T> = { data: T[]; meta: ListMeta };

export const clientsApi = {
  async list(filters: ClientListFilters = {}): Promise<ListResponse<ReturnType<typeof mapClient>>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: clientStatusToDb(filters.status) } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 100,
    };
    const raw = await request<{ data: BackendClient[]; meta: ListMeta }>("/clients", { query });
    return { data: raw.data.map(mapClient), meta: raw.meta };
  },

  async get(id: string): Promise<ReturnType<typeof mapClient>> {
    const raw = await request<BackendClient>(`/clients/${id}`);
    return mapClient(raw);
  },

  async create(data: {
    name: string;
    company?: string;
    email: string;
    phone?: string;
    notes?: string;
  }): Promise<ReturnType<typeof mapClient>> {
    const raw = await request<BackendClient>("/clients", { method: "POST", body: data });
    return mapClient(raw);
  },

  async update(id: string, patch: Record<string, unknown>): Promise<ReturnType<typeof mapClient>> {
    const raw = await request<BackendClient>(`/clients/${id}`, { method: "PATCH", body: patch });
    return mapClient(raw);
  },

  async remove(id: string): Promise<void> {
    await request(`/clients/${id}`, { method: "DELETE" });
  },
};

// ============================================================
// HOSTING SERVICES  —  conectado al backend real
// ============================================================
export const hostingApi = {
  async list(
    filters: ServiceListFilters = {},
  ): Promise<ListResponse<ReturnType<typeof mapService>>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.planId ? { planId: filters.planId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: serviceStatusToDb(filters.status) } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 100,
    };
    const raw = await request<{ data: BackendService[]; meta: ListMeta }>("/hosting/services", {
      query,
    });
    return { data: raw.data.map(mapService), meta: raw.meta };
  },

  async get(id: string): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>(`/hosting/services/${id}`);
    return mapService(raw);
  },

  async create(data: Record<string, unknown>): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>("/hosting/services", { method: "POST", body: data });
    return mapService(raw);
  },

  async update(id: string, patch: Record<string, unknown>): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>(`/hosting/services/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return mapService(raw);
  },

  async suspend(id: string): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>(`/hosting/services/${id}/suspend`, {
      method: "POST",
    });
    return mapService(raw);
  },

  async reactivate(id: string): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>(`/hosting/services/${id}/reactivate`, {
      method: "POST",
    });
    return mapService(raw);
  },

  async changePlan(id: string, planId: string): Promise<ReturnType<typeof mapService>> {
    const raw = await request<BackendService>(`/hosting/services/${id}/change-plan`, {
      method: "POST",
      body: { planId },
    });
    return mapService(raw);
  },
};

// ============================================================
// PLANS  —  conectado al backend real
// ============================================================
export const plansApi = {
  async list(): Promise<ListResponse<ReturnType<typeof mapPlan>>> {
    const raw = await request<{ data: BackendPlan[]; meta: ListMeta }>("/hosting/plans");
    return { data: raw.data.map(mapPlan), meta: raw.meta };
  },

  async create(data: Record<string, unknown>): Promise<ReturnType<typeof mapPlan>> {
    const raw = await request<BackendPlan>("/hosting/plans", { method: "POST", body: data });
    return mapPlan(raw);
  },

  async update(id: string, patch: Record<string, unknown>): Promise<ReturnType<typeof mapPlan>> {
    const raw = await request<BackendPlan>(`/hosting/plans/${id}`, {
      method: "PATCH",
      body: patch,
    });
    return mapPlan(raw);
  },
};

// ============================================================
// DOMAINS  —  conectado al backend real
// ============================================================
import { mapDomain, domainStatusToDb, type BackendDomain, type MappedDomain } from "./api-mappers";

export interface DomainFilters {
  clientId?: string;
  serviceId?: string;
  status?: string;
  search?: string;
  expiringInDays?: number;
  page?: number;
  limit?: number;
}

export const domainsApi = {
  async list(filters: DomainFilters = {}): Promise<ListResponse<MappedDomain>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: domainStatusToDb(filters.status) } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.expiringInDays ? { expiringInDays: filters.expiringInDays } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 100,
    };
    const raw = await request<{ data: BackendDomain[]; meta: ListMeta }>("/domains", { query });
    return { data: raw.data.map(mapDomain), meta: raw.meta };
  },

  async get(id: string): Promise<MappedDomain> {
    return mapDomain(await request<BackendDomain>(`/domains/${id}`));
  },

  async create(data: Record<string, unknown>): Promise<MappedDomain> {
    return mapDomain(await request<BackendDomain>("/domains", { method: "POST", body: data }));
  },

  async update(id: string, patch: Record<string, unknown>): Promise<MappedDomain> {
    return mapDomain(
      await request<BackendDomain>(`/domains/${id}`, { method: "PATCH", body: patch }),
    );
  },

  async delete(id: string): Promise<void> {
    await request(`/domains/${id}`, { method: "DELETE" });
  },

  async renew(id: string, data: Record<string, unknown>): Promise<MappedDomain> {
    return mapDomain(
      await request<BackendDomain>(`/domains/${id}/renew`, { method: "POST", body: data }),
    );
  },

  async sendReminder(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/domains/${id}/send-reminder`, { method: "POST" });
  },
};

// ============================================================
// PAYMENTS  —  conectado al backend real
// ============================================================
import {
  mapPayment,
  mapNotice,
  paymentStatusToDb,
  noticeStatusToDb,
  methodToDb,
  type BackendPayment,
  type BackendNotice,
  type MappedPayment,
  type MappedNotice,
} from "./api-mappers";

export interface PaymentFilters {
  clientId?: string;
  serviceId?: string;
  status?: string; // español
  method?: string; // español
  periodMonth?: number;
  periodYear?: number;
  page?: number;
  limit?: number;
}

export interface NoticeFilters {
  clientId?: string;
  serviceId?: string;
  status?: string; // español
  search?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  async list(filters: PaymentFilters = {}): Promise<ListResponse<MappedPayment>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: paymentStatusToDb(filters.status) } : {}),
      ...(filters.method ? { method: methodToDb(filters.method) } : {}),
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
    const raw = await request<{ data: BackendPayment[]; meta: ListMeta }>("/billing/payments", {
      query,
    });
    return { data: raw.data.map(mapPayment), meta: raw.meta };
  },

  async get(id: string): Promise<MappedPayment> {
    return mapPayment(await request<BackendPayment>(`/billing/payments/${id}`));
  },

  async create(data: Record<string, unknown>): Promise<MappedPayment> {
    return mapPayment(
      await request<BackendPayment>("/billing/payments", { method: "POST", body: data }),
    );
  },

  async update(id: string, patch: Record<string, unknown>): Promise<MappedPayment> {
    return mapPayment(
      await request<BackendPayment>(`/billing/payments/${id}`, { method: "PATCH", body: patch }),
    );
  },

  async markPaid(id: string): Promise<MappedPayment> {
    return mapPayment(
      await request<BackendPayment>(`/billing/payments/${id}/mark-paid`, { method: "POST" }),
    );
  },
};

// ============================================================
// PAYMENT NOTICES  —  conectado al backend real
// ============================================================
export const noticesApi = {
  async list(filters: NoticeFilters = {}): Promise<ListResponse<MappedNotice>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: noticeStatusToDb(filters.status) } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
    const raw = await request<{ data: BackendNotice[]; meta: ListMeta }>("/billing/notices", {
      query,
    });
    return { data: raw.data.map(mapNotice), meta: raw.meta };
  },

  async get(id: string): Promise<MappedNotice> {
    return mapNotice(await request<BackendNotice>(`/billing/notices/${id}`));
  },

  async create(data: Record<string, unknown>): Promise<MappedNotice> {
    return mapNotice(
      await request<BackendNotice>("/billing/notices", { method: "POST", body: data }),
    );
  },

  async update(id: string, patch: Record<string, unknown>): Promise<MappedNotice> {
    return mapNotice(
      await request<BackendNotice>(`/billing/notices/${id}`, { method: "PATCH", body: patch }),
    );
  },

  async send(id: string): Promise<MappedNotice> {
    return mapNotice(
      await request<BackendNotice>(`/billing/notices/${id}/send`, { method: "POST" }),
    );
  },

  async pdf(
    id: string,
  ): Promise<{ id: string; noticeNumber: string; pdfUrl: string | null; message: string }> {
    return request(`/billing/notices/${id}/pdf`, { method: "POST" });
  },

  async cancel(id: string): Promise<MappedNotice> {
    return mapNotice(
      await request<BackendNotice>(`/billing/notices/${id}/cancel`, { method: "POST" }),
    );
  },
};

// ============================================================
// BILLING SUMMARY
// ============================================================
export interface ClientBillingSummary {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  debt: number;
  lastPaymentDate: string | null;
  servicesCount: number;
  noticesPending: number;
  noticesOverdue: number;
  nextDueDate: string | null;
}

export interface GlobalBillingSummary {
  monthly: number;
  annualProjection: number;
  collectedThisMonth: number;
  pending: number;
  debt: number;
  pendingNoticesCount: number;
  overdueNoticesCount: number;
  revenueLast12Months: { month: number; year: number; total: number }[];
  paidVsPending: { name: string; value: number }[];
  planDistribution: { name: string; value: number }[];
  overduePayments: {
    id: string;
    clientId: string;
    clientCompany: string;
    serviceDomain: string;
    periodMonth: number;
    periodYear: number;
    amount: number;
    status: string;
  }[];
}

export const billingApi = {
  clientSummary: (clientId: string) =>
    request<ClientBillingSummary>(`/billing/clients/${clientId}/summary`),

  globalSummary: () => request<GlobalBillingSummary>("/billing/summary"),
};

// ============================================================
// SUPPORT — conectado al backend real
// ============================================================
import {
  mapTicket,
  ticketStatusToDb,
  ticketPriorityToDb,
  type BackendTicket,
  type MappedTicket,
} from "./api-mappers";

export interface SupportFilters {
  clientId?: string;
  serviceId?: string;
  status?: string; // español
  priority?: string; // español
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const supportApi = {
  async listTickets(filters: SupportFilters = {}): Promise<ListResponse<MappedTicket>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: ticketStatusToDb(filters.status) } : {}),
      ...(filters.priority ? { priority: ticketPriorityToDb(filters.priority) } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    };
    const raw = await request<{ data: BackendTicket[]; meta: ListMeta }>("/support", { query });
    return { data: raw.data.map(mapTicket), meta: raw.meta };
  },

  async getTicket(id: string): Promise<MappedTicket & { messages: any[] }> {
    const raw = await request<BackendTicket & { messages: any[] }>(`/support/${id}`);
    return { ...mapTicket(raw), messages: raw.messages };
  },

  async createTicket(data: Record<string, unknown>): Promise<MappedTicket> {
    return mapTicket(await request<BackendTicket>("/support", { method: "POST", body: data }));
  },

  async updateTicket(id: string, patch: Record<string, unknown>): Promise<MappedTicket> {
    return mapTicket(
      await request<BackendTicket>(`/support/${id}`, { method: "PATCH", body: patch }),
    );
  },

  async addMessage(ticketId: string, message: string, isInternal: boolean = false): Promise<any> {
    return request(`/support/${ticketId}/messages`, {
      method: "POST",
      body: { message, isInternal },
    });
  },

  async assignTicket(id: string, assignedTo: string): Promise<MappedTicket> {
    return mapTicket(
      await request<BackendTicket>(`/support/${id}/assign`, {
        method: "POST",
        body: { assignedTo },
      }),
    );
  },

  async resolveTicket(id: string): Promise<MappedTicket> {
    return mapTicket(await request<BackendTicket>(`/support/${id}/resolve`, { method: "POST" }));
  },

  async closeTicket(id: string): Promise<MappedTicket> {
    return mapTicket(await request<BackendTicket>(`/support/${id}/close`, { method: "POST" }));
  },
};

// ============================================================
// TASKS — conectado al backend real
// ============================================================
import {
  mapTask,
  taskStatusToDb,
  taskPriorityToDb,
  type BackendTask,
  type MappedTask,
} from "./api-mappers";

export interface TaskFilters {
  status?: string; // español
  priority?: string; // español
  assignedTo?: string;
  clientId?: string;
  serviceId?: string;
  domainId?: string;
  ticketId?: string;
  search?: string;
  dueBefore?: string;
  page?: number;
  limit?: number;
}

export const tasksApi = {
  async listTasks(filters: TaskFilters = {}): Promise<ListResponse<MappedTask>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...(filters.status ? { status: taskStatusToDb(filters.status) } : {}),
      ...(filters.priority ? { priority: taskPriorityToDb(filters.priority) } : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.domainId ? { domainId: filters.domainId } : {}),
      ...(filters.ticketId ? { ticketId: filters.ticketId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.dueBefore ? { dueBefore: filters.dueBefore } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    };
    const raw = await request<{ data: BackendTask[]; meta: ListMeta }>("/tasks", { query });
    return { data: raw.data.map(mapTask), meta: raw.meta };
  },

  async getTask(id: string): Promise<MappedTask> {
    return mapTask(await request<BackendTask>(`/tasks/${id}`));
  },

  async createTask(data: Record<string, unknown>): Promise<MappedTask> {
    return mapTask(await request<BackendTask>("/tasks", { method: "POST", body: data }));
  },

  async updateTask(id: string, patch: Record<string, unknown>): Promise<MappedTask> {
    return mapTask(await request<BackendTask>(`/tasks/${id}`, { method: "PATCH", body: patch }));
  },

  async deleteTask(id: string): Promise<MappedTask> {
    return mapTask(await request<BackendTask>(`/tasks/${id}`, { method: "DELETE" }));
  },

  async completeTask(id: string): Promise<MappedTask> {
    return mapTask(await request<BackendTask>(`/tasks/${id}/complete`, { method: "POST" }));
  },

  async reopenTask(id: string): Promise<MappedTask> {
    return mapTask(await request<BackendTask>(`/tasks/${id}/reopen`, { method: "POST" }));
  },
};

// ============================================================
// AUTOMATIONS
// ============================================================
export const automationsApi = {
  list: () => mock(automationRepository.findAll()), // GET   /api/automations
  update: (id: string, patch: Partial<AutomationRule>) => mock({ id, patch }), // PATCH /api/automations/:id
};

// ============================================================
// DASHBOARD + OPERATIONS
// ============================================================
export interface DashboardData {
  activeClients: number;
  activeServices: number;
  pendingPaymentsCount: number;
  monthlyRevenue: number;
  collectedThisMonth: number;
  totalDebt: number;
  overdueNoticesCount: number;
  newClientsThisMonth: number;
  upcomingServices: {
    id: string;
    domain: string;
    nextDueDate: string;
    monthlyPrice: number;
    status: string;
    clientCompany: string;
    clientId: string;
    planName: string;
  }[];
  clientsWithDebt: {
    id: string;
    company: string;
    email: string;
    debt: number;
    lastPaymentDate: string | null;
    nextDueDate: string | null;
  }[];
  recentPayments: {
    id: string;
    amount: number;
    status: string;
    method: string;
    paidAt: string | null;
    periodMonth: number;
    periodYear: number;
    clientCompany: string;
    serviceDomain: string | null;
  }[];
  recentNotices: {
    id: string;
    noticeNumber: string;
    amount: number;
    status: string;
    dueDate: string;
    periodMonth: number;
    periodYear: number;
    clientCompany: string;
    serviceDomain: string | null;
  }[];
}

export const dashboardApi = {
  admin: () => request<DashboardData>("/dashboard/admin"),
  client: (clientId: string) => mock({ clientId }), // GET /api/dashboard/client (futuro)
};
export const operationsApi = {
  summary: () =>
    mock({
      /* tickets+dominios+tareas+pagos urgentes */
    }), // GET /api/operations/summary
};

// ============================================================
// EMAIL
// ============================================================
export interface EmailLogFilters {
  status?: string;
  type?: string;
  recipient?: string;
  page?: number;
  limit?: number;
}

export const emailApi = {
  test: (to: string) => request<{ message: string }>("/email/test", { method: "POST", body: { to } }),
  listLogs: (filters: EmailLogFilters = {}) => {
    const query: Record<string, string | number | undefined> = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.recipient ? { recipient: filters.recipient } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
    return request<{ data: any[]; meta: { page: number; limit: number; total: number } }>("/email/logs", { query });
  },
};

// ============================================================
// HESTIACP
// ============================================================
export const hestiaApi = {
  testStatus: () => request<{ connected: boolean; server: string; message: string }>("/hestia/status"),
  listUsers: () => request<{ data: any[]; meta: { total: number } }>("/hestia/users"),
  getUser: (username: string) => request<any>(`/hestia/users/${username}`),
};

// ============================================================
// INTEGRATIONS (server-side wrappers — el frontend NO los llama directo)
// ------------------------------------------------------------
// Documentados acá como contrato esperado del backend Node.js.
//
// HestiaCP   → backend usa HESTIA_API_KEY (server-only)
//   • POST /hestia/users           crear usuario
//   • POST /hestia/users/:u/suspend / /reactivate
//   • GET  /hestia/users/:u/usage  uso de disco + cuentas correo
//   • GET  /hestia/users/:u/domains
//
// MercadoPago → MP_ACCESS_TOKEN (server-only)
//   • POST /mp/preferences        crear preferencia, devolver init_point
//   • POST /webhooks/mercadopago  webhook (idempotente, valida x-signature)
//
// PayPal      → PAYPAL_CLIENT_ID + PAYPAL_SECRET
//   • POST /paypal/checkout       crear orden
//   • POST /webhooks/paypal       webhook (valida transmission-sig)
//
// Email       → Resend / SendGrid / SES
//   • POST /notifications/payment-notice
//   • POST /notifications/due-reminder
//   • POST /notifications/ticket-reply
//
// WhatsApp    → Twilio / WhatsApp Cloud API (fase futura)
//   • POST /notifications/whatsapp
// ============================================================

// ============================================================
// SETTINGS
// ============================================================
export const settingsApi = {
  getCompany: () => request("/settings/company"),
  updateCompany: (data: Record<string, any>) =>
    request("/settings/company", { method: "PUT", body: data }),
  getReadiness: () => request("/settings/readiness"),
};
