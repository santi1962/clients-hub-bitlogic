// Mock data + types for Bitlogic Client Portal

export type ServiceStatus =
  | "activo"
  | "proximo_a_vencer"
  | "pendiente"
  | "suspendido"
  | "cancelado"
  | "vencido";
export type PaymentStatus = "pagado" | "pendiente" | "vencido";
export type NoticeStatus = "emitido" | "pagado" | "vencido";
export type ClientStatus = "activo" | "inactivo";

export interface Plan {
  id: string;
  name: string;
  storageGB: number;
  sites: number | "ilimitados";
  emails: number | "ilimitados";
  monthlyPrice: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
}

export interface HostingService {
  id: string;
  clientId: string;
  domain: string;
  planId: string;
  status: ServiceStatus;
  usedGB: number;
  totalGB: number;
  usedEmails: number;
  totalEmails: number | "ilimitados";
  startDate: string;
  nextDueDate: string;
  monthlyPrice: number;
  hestiaUser: string;
  hestiaUrl: string;
  notes?: string;
}

export interface Payment {
  id: string;
  clientId: string;
  serviceId: string;
  periodMonth: string;
  amount: number;
  method: string;
  paidAt: string | null;
  status: PaymentStatus;
}

export interface PaymentNotice {
  id: string;
  clientId: string;
  serviceId: string;
  period: string;
  amount: number;
  issuedAt: string;
  dueAt: string;
  status: NoticeStatus;
}

export const plans: Plan[] = [
  { id: "p-starter", name: "Starter", storageGB: 5, sites: 1, emails: 5, monthlyPrice: 8 },
  { id: "p-pro", name: "Pro", storageGB: 15, sites: 3, emails: 20, monthlyPrice: 18 },
  {
    id: "p-business",
    name: "Business",
    storageGB: 40,
    sites: "ilimitados",
    emails: "ilimitados",
    monthlyPrice: 35,
  },
];

export const clients: Client[] = [];
export const services: HostingService[] = [];
export const payments: Payment[] = [];
export const notices: PaymentNotice[] = [];

// Hardcoded "today" para hacer datos consistentes en demo
export const TODAY = "2026-06-16";

export const getClient = (id: string) => clients.find((c) => c.id === id);
export const getPlan = (id: string) => plans.find((p) => p.id === id);
export const getService = (id: string) => services.find((s) => s.id === id);

export const clientServices = (clientId: string) => services.filter((s) => s.clientId === clientId);
export const clientPayments = (clientId: string) => payments.filter((p) => p.clientId === clientId);
export const clientNotices = (clientId: string) => notices.filter((n) => n.clientId === clientId);
export const serviceNotices = (serviceId: string) =>
  notices.filter((n) => n.serviceId === serviceId);

export function lastPaymentForClient(clientId: string): Payment | undefined {
  return clientPayments(clientId)
    .filter((p) => p.status === "pagado" && p.paidAt)
    .sort((a, b) => (b.paidAt! > a.paidAt! ? 1 : -1))[0];
}

export function nextDueForClient(clientId: string): string | undefined {
  const dates = clientServices(clientId)
    .map((s) => s.nextDueDate)
    .sort();
  return dates[0];
}

export function clientFinancials(clientId: string) {
  const pays = clientPayments(clientId);
  const totalPaid = pays.filter((p) => p.status === "pagado").reduce((a, p) => a + p.amount, 0);
  const debt = pays
    .filter((p) => p.status === "vencido" || p.status === "pendiente")
    .reduce((a, p) => a + p.amount, 0);
  return { totalPaid, debt, paymentsCount: pays.length };
}

// --- Date helpers (hydration-safe: parse YYYY-MM-DD as LOCAL date, never UTC) ---
function parseLocalDate(d: string): Date {
  const [y, m, day] = d.split("T")[0].split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function formatMoney(n: number, currency = "ARS") {
  const currencySymbols: Record<string, string> = {
    ARS: "$",
    USD: "USD ",
  };
  const locale = currency === "ARS" ? "es-AR" : "en-US";
  const symbol = currencySymbols[currency] || currency;
  return symbol + " " + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatDate(d?: string | null) {
  if (!d) return "—";
  const date = parseLocalDate(d);
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLongDate(d?: string | null) {
  if (!d) return "—";
  const date = parseLocalDate(d);
  const MONTHS_FULL = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${date.getDate()} de ${MONTHS_FULL[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  const MONTHS_FULL = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${MONTHS_FULL[(m ?? 1) - 1]} ${y}`;
}

export function daysUntil(d: string): number {
  const today = parseLocalDate(TODAY);
  const target = parseLocalDate(d);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isWithinNextDays(d: string, days: number) {
  const diff = daysUntil(d);
  return diff >= 0 && diff <= days;
}

// --- KPIs / aggregations ---
export const kpis = {
  activeClients: clients.filter((c) => c.status === "activo").length,
  activeServices: services.filter((s) => s.status === "activo" || s.status === "proximo_a_vencer")
    .length,
  pendingPayments: payments.filter((p) => p.status === "pendiente").length,
  expiredServices: services.filter((s) => s.status === "vencido" || s.status === "suspendido")
    .length,
  monthlyRevenue: services
    .filter((s) => s.status === "activo" || s.status === "proximo_a_vencer")
    .reduce((acc, s) => acc + s.monthlyPrice, 0),
};

export function billingMetrics() {
  const monthly = kpis.monthlyRevenue;
  const annualProjection = monthly * 12;
  const collectedThisMonth = payments
    .filter((p) => p.status === "pagado" && p.paidAt && p.paidAt.startsWith(TODAY.slice(0, 7)))
    .reduce((a, p) => a + p.amount, 0);
  const pending = payments
    .filter((p) => p.status === "pendiente")
    .reduce((a, p) => a + p.amount, 0);
  const debt = payments.filter((p) => p.status === "vencido").reduce((a, p) => a + p.amount, 0);
  return { monthly, annualProjection, collectedThisMonth, pending, debt };
}

export function dashboardExtras() {
  const dueSoon = services.filter(
    (s) =>
      isWithinNextDays(s.nextDueDate, 7) && s.status !== "cancelado" && s.status !== "suspendido",
  );
  const debtors = clients.filter((c) => clientFinancials(c.id).debt > 0);
  const thisMonth = TODAY.slice(0, 7);
  const newClients = clients.filter((c) => c.createdAt.startsWith(thisMonth));
  return { dueSoon, debtors, newClients };
}

// Charts data (mock 12 meses)
export function revenueLast12Months() {
  const base = [
    { m: "Jul 25", v: 142 },
    { m: "Ago 25", v: 158 },
    { m: "Sep 25", v: 165 },
    { m: "Oct 25", v: 170 },
    { m: "Nov 25", v: 178 },
    { m: "Dic 25", v: 185 },
    { m: "Ene 26", v: 192 },
    { m: "Feb 26", v: 198 },
    { m: "Mar 26", v: 205 },
    { m: "Abr 26", v: 212 },
    { m: "May 26", v: 218 },
    { m: "Jun 26", v: 226 },
  ];
  return base;
}

export function paidVsPending() {
  const m = billingMetrics();
  return [
    { name: "Cobrado", value: m.collectedThisMonth },
    { name: "Pendiente", value: m.pending },
    { name: "Vencido", value: m.debt },
  ];
}

export function planDistribution() {
  return plans.map((p) => ({
    name: p.name,
    value: services.filter((s) => s.planId === p.id).length,
  }));
}
