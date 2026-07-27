import { useQuery } from "@tanstack/react-query";
import { request } from "./api-client";

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
  | "access_sent"
  | string;

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  description?: string;
  actor: string;
  createdAt: string;
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

interface AuditLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  created_at: string;
}

const ACTION_KIND_MAP: Record<string, ActivityKind> = {
  crear_cliente: "client_created",
  crear_servicio: "service_created",
  suspender_servicio: "service_suspended",
  reactivar_servicio: "service_reactivated",
  cambiar_plan: "service_plan_changed",
  crear_aviso: "payment_notice_created",
  registrar_pago: "payment_registered",
  crear_ticket: "ticket_created",
  renovar_dominio: "domain_renewed",
  crear_tarea: "task_created",
  enviar_accesos: "access_sent",
};

function mapLog(log: AuditLog): ActivityEvent {
  const actionKey = `${log.action}_${log.entity_type}`.toLowerCase().replace(/\s+/g, "_");
  const kind: ActivityKind = ACTION_KIND_MAP[actionKey] ?? ACTION_KIND_MAP[log.action] ?? log.action;

  const title = log.entity_name
    ? `${log.entity_name} — ${log.action}`
    : `${log.entity_type}: ${log.action}`;

  return {
    id: log.id,
    kind,
    title,
    actor: log.user_name ?? "Sistema",
    createdAt: log.created_at,
    refs: { [entityTypeToRef(log.entity_type)]: log.entity_id },
  };
}

function entityTypeToRef(entityType: string): keyof NonNullable<ActivityEvent["refs"]> {
  const map: Record<string, keyof NonNullable<ActivityEvent["refs"]>> = {
    cliente: "clientId",
    servicio: "serviceId",
    dominio: "domainId",
    ticket: "ticketId",
    pago: "paymentId",
    aviso: "noticeId",
    plan: "planId",
    tarea: "taskId",
  };
  return map[entityType] ?? "clientId";
}

export interface AuditFilter {
  entityId?: string;
  entityType?: string;
  limit?: number;
}

export function useActivity(filter?: AuditFilter) {
  const params = new URLSearchParams();
  if (filter?.entityId) params.set("entityId", filter.entityId);
  if (filter?.entityType) params.set("entityType", filter.entityType);
  params.set("limit", String(filter?.limit ?? 50));

  const { data } = useQuery<{ data: AuditLog[] }>({
    queryKey: ["audit", "list", filter],
    queryFn: () =>
      request<{ data: AuditLog[] }>(`/audit?${params.toString()}`),
    staleTime: 30_000,
  });

  return (data?.data ?? []).map(mapLog);
}
