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

export const clients: Client[] = [
  {
    id: "c1",
    name: "Lucía Fernández",
    email: "lucia@cafedelvalle.com",
    phone: "+54 11 5555-1010",
    company: "Café del Valle",
    status: "activo",
    notes: "Cliente histórico, paga en término.",
    createdAt: "2023-02-12",
  },
  {
    id: "c2",
    name: "Martín Acosta",
    email: "martin@estudioacosta.com.ar",
    phone: "+54 11 5555-2020",
    company: "Estudio Acosta",
    status: "activo",
    notes: "",
    createdAt: "2023-05-04",
  },
  {
    id: "c3",
    name: "Sofía Ramírez",
    email: "sofi@mundofit.com",
    phone: "+54 351 555-3030",
    company: "MundoFit",
    status: "activo",
    notes: "Pidió presupuesto upgrade a Business.",
    createdAt: "2024-01-18",
  },
  {
    id: "c4",
    name: "Diego Pereyra",
    email: "dpereyra@logisur.com",
    phone: "+54 11 5555-4040",
    company: "Logisur SRL",
    status: "activo",
    notes: "",
    createdAt: "2024-03-22",
  },
  {
    id: "c5",
    name: "Camila Suárez",
    email: "camila@belladermo.com",
    phone: "+54 11 5555-5050",
    company: "Belladermo",
    status: "activo",
    notes: "Tiene 2 sitios y se le suspendió uno.",
    createdAt: "2024-06-09",
  },
  {
    id: "c6",
    name: "Federico Luna",
    email: "fede@luna-arquitectos.com",
    phone: "+54 261 555-6060",
    company: "Luna Arquitectos",
    status: "activo",
    notes: "",
    createdAt: "2026-06-03",
  },
  {
    id: "c7",
    name: "Romina Vidal",
    email: "rvidal@dentalplus.com",
    phone: "+54 11 5555-7070",
    company: "DentalPlus",
    status: "inactivo",
    notes: "Pausó el servicio por reformas.",
    createdAt: "2023-11-30",
  },
  {
    id: "c8",
    name: "Joaquín Méndez",
    email: "joaquin@tiendamendez.com",
    phone: "+54 11 5555-8080",
    company: "Tienda Méndez",
    status: "activo",
    notes: "",
    createdAt: "2026-06-10",
  },
];

export const services: HostingService[] = [
  {
    id: "s1",
    clientId: "c1",
    domain: "cafedelvalle.com",
    planId: "p-pro",
    status: "activo",
    usedGB: 6.2,
    totalGB: 15,
    usedEmails: 8,
    totalEmails: 20,
    startDate: "2023-02-15",
    nextDueDate: "2026-06-25",
    monthlyPrice: 18,
    hestiaUser: "cafedelvalle",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "Migrado desde shared en 2023.",
  },
  {
    id: "s2",
    clientId: "c2",
    domain: "estudioacosta.com.ar",
    planId: "p-starter",
    status: "activo",
    usedGB: 2.1,
    totalGB: 5,
    usedEmails: 3,
    totalEmails: 5,
    startDate: "2023-05-10",
    nextDueDate: "2026-06-30",
    monthlyPrice: 8,
    hestiaUser: "estudioac",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s3",
    clientId: "c3",
    domain: "mundofit.com",
    planId: "p-pro",
    status: "proximo_a_vencer",
    usedGB: 11.8,
    totalGB: 15,
    usedEmails: 14,
    totalEmails: 20,
    startDate: "2024-01-20",
    nextDueDate: "2026-06-20",
    monthlyPrice: 18,
    hestiaUser: "mundofit",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s4",
    clientId: "c3",
    domain: "tienda.mundofit.com",
    planId: "p-starter",
    status: "pendiente",
    usedGB: 1.4,
    totalGB: 5,
    usedEmails: 1,
    totalEmails: 5,
    startDate: "2025-03-05",
    nextDueDate: "2026-06-18",
    monthlyPrice: 8,
    hestiaUser: "tiendamf",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "Esperando confirmación de pago.",
  },
  {
    id: "s5",
    clientId: "c4",
    domain: "logisur.com",
    planId: "p-business",
    status: "activo",
    usedGB: 22.5,
    totalGB: 40,
    usedEmails: 42,
    totalEmails: "ilimitados",
    startDate: "2024-03-25",
    nextDueDate: "2026-07-10",
    monthlyPrice: 35,
    hestiaUser: "logisur",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s6",
    clientId: "c5",
    domain: "belladermo.com",
    planId: "p-pro",
    status: "activo",
    usedGB: 9.7,
    totalGB: 15,
    usedEmails: 11,
    totalEmails: 20,
    startDate: "2024-06-12",
    nextDueDate: "2026-06-22",
    monthlyPrice: 18,
    hestiaUser: "belladermo",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s7",
    clientId: "c5",
    domain: "blog.belladermo.com",
    planId: "p-starter",
    status: "suspendido",
    usedGB: 0.6,
    totalGB: 5,
    usedEmails: 0,
    totalEmails: 5,
    startDate: "2024-08-02",
    nextDueDate: "2026-05-02",
    monthlyPrice: 8,
    hestiaUser: "blogbella",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "Suspendido por falta de pago de 2 meses.",
  },
  {
    id: "s8",
    clientId: "c6",
    domain: "luna-arquitectos.com",
    planId: "p-starter",
    status: "activo",
    usedGB: 3.0,
    totalGB: 5,
    usedEmails: 2,
    totalEmails: 5,
    startDate: "2024-09-20",
    nextDueDate: "2026-06-28",
    monthlyPrice: 8,
    hestiaUser: "lunaarq",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s9",
    clientId: "c7",
    domain: "dentalplus.com",
    planId: "p-pro",
    status: "cancelado",
    usedGB: 5.4,
    totalGB: 15,
    usedEmails: 6,
    totalEmails: 20,
    startDate: "2023-12-01",
    nextDueDate: "2026-04-15",
    monthlyPrice: 18,
    hestiaUser: "dentalplus",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "Cliente solicitó baja.",
  },
  {
    id: "s10",
    clientId: "c8",
    domain: "tiendamendez.com",
    planId: "p-pro",
    status: "activo",
    usedGB: 7.9,
    totalGB: 15,
    usedEmails: 5,
    totalEmails: 20,
    startDate: "2025-01-12",
    nextDueDate: "2026-07-05",
    monthlyPrice: 18,
    hestiaUser: "tiendamz",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s11",
    clientId: "c2",
    domain: "blog.estudioacosta.com.ar",
    planId: "p-starter",
    status: "vencido",
    usedGB: 1.8,
    totalGB: 5,
    usedEmails: 1,
    totalEmails: 5,
    startDate: "2024-04-10",
    nextDueDate: "2026-05-30",
    monthlyPrice: 8,
    hestiaUser: "blogeac",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
  {
    id: "s12",
    clientId: "c4",
    domain: "intranet.logisur.com",
    planId: "p-starter",
    status: "vencido",
    usedGB: 4.5,
    totalGB: 5,
    usedEmails: 4,
    totalEmails: 5,
    startDate: "2024-07-22",
    nextDueDate: "2026-06-01",
    monthlyPrice: 8,
    hestiaUser: "intralog",
    hestiaUrl: "https://hestia.bitlogic.dev:8083",
    notes: "",
  },
];

export const payments: Payment[] = [
  {
    id: "pm1",
    clientId: "c1",
    serviceId: "s1",
    periodMonth: "2026-05",
    amount: 18,
    method: "Transferencia",
    paidAt: "2026-05-24",
    status: "pagado",
  },
  {
    id: "pm2",
    clientId: "c1",
    serviceId: "s1",
    periodMonth: "2026-06",
    amount: 18,
    method: "—",
    paidAt: null,
    status: "pendiente",
  },
  {
    id: "pm3",
    clientId: "c2",
    serviceId: "s2",
    periodMonth: "2026-06",
    amount: 8,
    method: "Mercado Pago",
    paidAt: "2026-06-01",
    status: "pagado",
  },
  {
    id: "pm4",
    clientId: "c2",
    serviceId: "s11",
    periodMonth: "2026-05",
    amount: 8,
    method: "—",
    paidAt: null,
    status: "vencido",
  },
  {
    id: "pm5",
    clientId: "c3",
    serviceId: "s3",
    periodMonth: "2026-06",
    amount: 18,
    method: "Stripe",
    paidAt: "2026-06-02",
    status: "pagado",
  },
  {
    id: "pm6",
    clientId: "c3",
    serviceId: "s4",
    periodMonth: "2026-06",
    amount: 8,
    method: "—",
    paidAt: null,
    status: "pendiente",
  },
  {
    id: "pm7",
    clientId: "c4",
    serviceId: "s5",
    periodMonth: "2026-06",
    amount: 35,
    method: "Transferencia",
    paidAt: "2026-06-08",
    status: "pagado",
  },
  {
    id: "pm8",
    clientId: "c4",
    serviceId: "s12",
    periodMonth: "2026-05",
    amount: 8,
    method: "—",
    paidAt: null,
    status: "vencido",
  },
  {
    id: "pm9",
    clientId: "c5",
    serviceId: "s6",
    periodMonth: "2026-06",
    amount: 18,
    method: "Mercado Pago",
    paidAt: "2026-06-12",
    status: "pagado",
  },
  {
    id: "pm10",
    clientId: "c5",
    serviceId: "s7",
    periodMonth: "2026-04",
    amount: 8,
    method: "—",
    paidAt: null,
    status: "vencido",
  },
  {
    id: "pm11",
    clientId: "c6",
    serviceId: "s8",
    periodMonth: "2026-06",
    amount: 8,
    method: "Transferencia",
    paidAt: "2026-06-03",
    status: "pagado",
  },
  {
    id: "pm12",
    clientId: "c8",
    serviceId: "s10",
    periodMonth: "2026-06",
    amount: 18,
    method: "Stripe",
    paidAt: "2026-06-09",
    status: "pagado",
  },
  {
    id: "pm13",
    clientId: "c7",
    serviceId: "s9",
    periodMonth: "2026-03",
    amount: 18,
    method: "—",
    paidAt: null,
    status: "vencido",
  },
];

export const notices: PaymentNotice[] = [
  {
    id: "n1",
    clientId: "c1",
    serviceId: "s1",
    period: "2026-06",
    amount: 18,
    issuedAt: "2026-06-10",
    dueAt: "2026-06-25",
    status: "emitido",
  },
  {
    id: "n2",
    clientId: "c2",
    serviceId: "s11",
    period: "2026-05",
    amount: 8,
    issuedAt: "2026-05-12",
    dueAt: "2026-05-30",
    status: "vencido",
  },
  {
    id: "n3",
    clientId: "c3",
    serviceId: "s4",
    period: "2026-06",
    amount: 8,
    issuedAt: "2026-06-05",
    dueAt: "2026-06-18",
    status: "emitido",
  },
  {
    id: "n4",
    clientId: "c4",
    serviceId: "s12",
    period: "2026-05",
    amount: 8,
    issuedAt: "2026-05-15",
    dueAt: "2026-06-01",
    status: "vencido",
  },
  {
    id: "n5",
    clientId: "c5",
    serviceId: "s7",
    period: "2026-04",
    amount: 8,
    issuedAt: "2026-04-18",
    dueAt: "2026-05-02",
    status: "vencido",
  },
  {
    id: "n6",
    clientId: "c6",
    serviceId: "s8",
    period: "2026-06",
    amount: 8,
    issuedAt: "2026-06-10",
    dueAt: "2026-06-28",
    status: "emitido",
  },
  {
    id: "n7",
    clientId: "c1",
    serviceId: "s1",
    period: "2026-05",
    amount: 18,
    issuedAt: "2026-05-10",
    dueAt: "2026-05-25",
    status: "pagado",
  },
];

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

export function formatMoney(n: number) {
  return "USD " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
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
