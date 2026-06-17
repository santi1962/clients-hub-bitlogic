/**
 * Datos mock del centro de notificaciones.
 * BACKEND: GET /api/notifications, PATCH /api/notifications/:id/read
 *          WebSocket /ws/notifications para push en vivo.
 */
export type NotifKind =
  | "hosting_due"
  | "domain_due"
  | "payment_ok"
  | "payment_late"
  | "ticket_new"
  | "task_assigned";
export type NotifState = "unread" | "read";

export interface Notification {
  id: string;
  kind: NotifKind;
  title: string;
  description: string;
  time: string;
  state: NotifState;
  important?: boolean;
  accent: string;
}

export const notifications: Notification[] = [
  {
    id: "n1",
    kind: "hosting_due",
    title: "Hosting próximo a vencer",
    description: "acme.com.ar — vence en 3 días",
    time: "hace 12 min",
    state: "unread",
    important: true,
    accent: "bg-warning/15 text-warning",
  },
  {
    id: "n2",
    kind: "domain_due",
    title: "Dominio por vencer",
    description: "estudio-lopez.ar — vence en 7 días",
    time: "hace 1 h",
    state: "unread",
    accent: "bg-info/15 text-info",
  },
  {
    id: "n3",
    kind: "payment_ok",
    title: "Pago recibido",
    description: "$ 28.500 — Acme S.A. (transferencia)",
    time: "hace 2 h",
    state: "unread",
    accent: "bg-success/15 text-success",
  },
  {
    id: "n4",
    kind: "payment_late",
    title: "Pago vencido",
    description: "Estudio López — $ 12.300 (5 días de atraso)",
    time: "hace 5 h",
    state: "read",
    important: true,
    accent: "bg-destructive/15 text-destructive",
  },
  {
    id: "n5",
    kind: "ticket_new",
    title: "Nuevo ticket de soporte",
    description: "#T-184 — Email no llega a casilla corporativa",
    time: "ayer",
    state: "read",
    accent: "bg-info/15 text-info",
  },
  {
    id: "n6",
    kind: "task_assigned",
    title: "Tarea asignada",
    description: "Migrar acme.com.ar a nuevo servidor",
    time: "ayer",
    state: "read",
    accent: "bg-primary/15 text-primary",
  },
  {
    id: "n7",
    kind: "payment_ok",
    title: "Pago recibido",
    description: "$ 9.800 — Studio Norte (MercadoPago)",
    time: "hace 2 días",
    state: "read",
    accent: "bg-success/15 text-success",
  },
];
