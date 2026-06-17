/**
 * ============================================================
 * Bitlogic — Activity Log (in-memory audit/timeline store)
 * ------------------------------------------------------------
 * Captura eventos de negocio generados por los workflows y los
 * expone a través de un hook con subscripción reactiva.
 *
 * BACKEND OBJETIVO:
 *   Tabla `audit_logs` (ver /arquitectura). Cada evento → fila.
 *   POST /api/audit-logs lo crea desde los endpoints de mutación.
 *   GET /api/audit-logs?entity=client&id=X devuelve el timeline.
 *
 * Hoy: estado en memoria + EventTarget para refresco.
 * ============================================================
 */
import { useEffect, useState } from "react";

export type ActivityKind =
  | "client_created"
  | "service_created"
  | "service_suspended"
  | "service_reactivated"
  | "service_plan_changed"
  | "payment_notice_created"
  | "payment_registered"
  | "ticket_created"
  | "domain_renewed"
  | "task_created"
  | "access_sent";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  actor: string; // usuario que originó la acción
  createdAt: string; // ISO
  /** Entidades vinculadas para filtrar el timeline. */
  refs?: {
    clientId?: string;
    serviceId?: string;
    domainId?: string;
    ticketId?: string;
    paymentId?: string;
    noticeId?: string;
    planId?: string;
    taskId?: string;
  };
}

const initial: ActivityEvent[] = [
  {
    id: "evt-seed-1",
    kind: "client_created",
    title: "Cliente Café del Valle registrado",
    actor: "Sistema",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    refs: { clientId: "c1" },
  },
  {
    id: "evt-seed-2",
    kind: "service_created",
    title: "Servicio cafedelvalle.com creado (Pro)",
    actor: "Mariano F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    refs: { clientId: "c1", serviceId: "s1", planId: "p-pro" },
  },
  {
    id: "evt-seed-3",
    kind: "payment_registered",
    title: "Pago recibido — USD 18",
    description: "Mercado Pago · período 2026-05",
    actor: "Mariano F.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    refs: { clientId: "c1", serviceId: "s1" },
  },
];

const store = {
  events: [...initial],
  target: new EventTarget(),
};

export function pushActivity(
  evt: Omit<ActivityEvent, "id" | "createdAt"> & { createdAt?: string },
) {
  const event: ActivityEvent = {
    id: `evt-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: evt.createdAt ?? new Date().toISOString(),
    ...evt,
  };
  store.events = [event, ...store.events];
  store.target.dispatchEvent(new Event("change"));
  return event;
}

export function getActivity(filter?: Partial<ActivityEvent["refs"]>): ActivityEvent[] {
  if (!filter) return store.events;
  const keys = Object.keys(filter) as (keyof NonNullable<ActivityEvent["refs"]>)[];
  return store.events.filter((e) => {
    if (!e.refs) return false;
    return keys.every(
      (k) => (filter as any)[k] === undefined || e.refs?.[k] === (filter as any)[k],
    );
  });
}

export function useActivity(filter?: Partial<ActivityEvent["refs"]>) {
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((n) => n + 1);
    store.target.addEventListener("change", h);
    return () => store.target.removeEventListener("change", h);
  }, []);
  return getActivity(filter);
}
