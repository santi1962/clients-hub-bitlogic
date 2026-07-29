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

// VACÍO - Todos los datos deben venir de la API /api/notifications
export const notifications: Notification[] = [];
