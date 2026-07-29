// Tipos de dominio compartidos entre mappers, api-client y las páginas.

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
