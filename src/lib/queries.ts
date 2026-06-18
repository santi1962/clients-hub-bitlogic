/**
 * React Query hooks para entidades reales (Fase 2A).
 *
 * Solo clients, plans y hosting services están conectados al backend.
 * El resto sigue usando mocks desde mock-data.ts / repositories.ts.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clientsApi,
  hostingApi,
  plansApi,
  paymentsApi,
  noticesApi,
  billingApi,
  dashboardApi,
  domainsApi,
  supportApi,
  tasksApi,
  type ClientListFilters,
  type ServiceListFilters,
  type PaymentFilters,
  type NoticeFilters,
  type DomainFilters,
  type SupportFilters,
  type TaskFilters,
} from "./api-client";
import type { HostingServiceFull } from "./api-mappers";

// ─────────────────────────────────────────────────────────────
// Query keys centralizados
// ─────────────────────────────────────────────────────────────
export const qk = {
  clients: {
    list: (f?: ClientListFilters) => ["clients", "list", f ?? {}] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
  },
  plans: {
    list: () => ["plans", "list"] as const,
  },
  services: {
    list: (f?: ServiceListFilters) => ["services", "list", f ?? {}] as const,
    detail: (id: string) => ["services", "detail", id] as const,
    byClient: (clientId: string) => ["services", "by-client", clientId] as const,
  },
};

// ─────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────
export function useClients(filters: ClientListFilters = {}) {
  return useQuery({
    queryKey: qk.clients.list(filters),
    queryFn: () => clientsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: qk.clients.detail(id),
    queryFn: () => clientsApi.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      company?: string;
      email: string;
      phone?: string;
      notes?: string;
    }) => clientsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cliente creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear cliente"),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => clientsApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cliente actualizado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar cliente"),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Cliente dado de baja");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error"),
  });
}

// ─────────────────────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────────────────────
export function usePlans() {
  return useQuery({
    queryKey: qk.plans.list(),
    queryFn: () => plansApi.list(),
    staleTime: 60_000, // planes cambian poco
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; [k: string]: unknown }) =>
      plansApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans.list() });
      toast.success("Plan actualizado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar plan"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans.list() });
      toast.success("Plan creado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear plan"),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      // Placeholder: simulamos la eliminación
      return Promise.resolve();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans.list() });
      toast.success("Plan eliminado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar plan"),
  });
}

// ─────────────────────────────────────────────────────────────
// HOSTING SERVICES
// ─────────────────────────────────────────────────────────────
export function useServices(filters: ServiceListFilters = {}) {
  return useQuery({
    queryKey: qk.services.list(filters),
    queryFn: () => hostingApi.list(filters),
    staleTime: 30_000,
  });
}

/** Servicios de un cliente específico (para la pestaña del detalle de cliente). */
export function useClientServices(clientId: string) {
  return useQuery({
    queryKey: qk.services.byClient(clientId),
    queryFn: () => hostingApi.list({ clientId }),
    enabled: Boolean(clientId),
    staleTime: 30_000,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: qk.services.detail(id),
    queryFn: () => hostingApi.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useSuspendService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hostingApi.suspend(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.warning(`Servicio ${data.domain} suspendido`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al suspender"),
  });
}

export function useReactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hostingApi.reactivate(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Servicio ${data.domain} reactivado`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al reactivar"),
  });
}

export function useChangeServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, planId }: { id: string; planId: string }) =>
      hostingApi.changePlan(id, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Plan actualizado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al cambiar plan"),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => hostingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Servicio creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear servicio"),
  });
}

// ─────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────
export function usePayments(filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: ["payments", "list", filters],
    queryFn: () => paymentsApi.list(filters),
    staleTime: 30_000,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ["payments", "detail", id],
    queryFn: () => paymentsApi.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => paymentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pago registrado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al registrar pago"),
  });
}

export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.markPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pago marcado como pagado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error"),
  });
}

// ─────────────────────────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────────────────────────
export function useNotices(filters: NoticeFilters = {}) {
  return useQuery({
    queryKey: ["notices", "list", filters],
    queryFn: () => noticesApi.list(filters),
    staleTime: 30_000,
  });
}

export function useNotice(id: string) {
  return useQuery({
    queryKey: ["notices", "detail", id],
    queryFn: () => noticesApi.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => noticesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Aviso de pago generado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al generar aviso"),
  });
}

export function useSendNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noticesApi.send(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Aviso marcado como enviado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al enviar aviso"),
  });
}

export function useCancelNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noticesApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.warning("Aviso cancelado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error"),
  });
}

// ─────────────────────────────────────────────────────────────
// BILLING SUMMARIES
// ─────────────────────────────────────────────────────────────
export function useClientBillingSummary(clientId: string) {
  return useQuery({
    queryKey: ["billing", "client", clientId],
    queryFn: () => billingApi.clientSummary(clientId),
    enabled: Boolean(clientId),
    staleTime: 30_000,
  });
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ["billing", "global"],
    queryFn: () => billingApi.globalSummary(),
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.admin(),
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────
// DOMAINS
// ─────────────────────────────────────────────────────────────
export function useDomains(filters: DomainFilters = {}) {
  return useQuery({
    queryKey: ["domains", "list", filters],
    queryFn: () => domainsApi.list(filters),
    staleTime: 30_000,
  });
}

export function useDomain(id: string) {
  return useQuery({
    queryKey: ["domains", "detail", id],
    queryFn: () => domainsApi.get(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => domainsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dominio creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear dominio"),
  });
}

export function useUpdateDomain(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => domainsApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dominio actualizado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar dominio"),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => domainsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dominio cancelado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al cancelar dominio"),
  });
}

export function useRenewDomain(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => domainsApi.renew(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dominio renovado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al renovar dominio"),
  });
}

export function useSendDomainReminder(id: string) {
  return useMutation({
    mutationFn: () => domainsApi.sendReminder(id),
    onSuccess: () => toast.success("Recordatorio enviado al cliente"),
    onError: (err: Error) => toast.error(err.message ?? "Error al enviar recordatorio"),
  });
}

// ─────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────
export function useTickets(filters: SupportFilters = {}) {
  return useQuery({
    queryKey: ["support", "list", filters],
    queryFn: () => supportApi.listTickets(filters),
    staleTime: 30_000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["support", "detail", id],
    queryFn: () => supportApi.getTicket(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => supportApi.createTicket(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ticket creado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear ticket"),
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => supportApi.updateTicket(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ticket actualizado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar ticket"),
  });
}

export function useAddTicketMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, isInternal }: { message: string; isInternal?: boolean }) =>
      supportApi.addMessage(id, message, isInternal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support", "detail", id] });
      toast.success("Mensaje agregado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al agregar mensaje"),
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedTo: string) => supportApi.assignTicket(id, assignedTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ticket asignado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al asignar ticket"),
  });
}

export function useResolveTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => supportApi.resolveTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ticket marcado como resuelto");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al resolver ticket"),
  });
}

export function useCloseTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => supportApi.closeTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ticket cerrado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al cerrar ticket"),
  });
}

// ─────────────────────────────────────────────────────────────
// INTERNAL TASKS
// ─────────────────────────────────────────────────────────────
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tasks", "list", filters],
    queryFn: () => tasksApi.listTasks(filters),
    staleTime: 30_000,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => tasksApi.getTask(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Tarea creada correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear tarea"),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => tasksApi.updateTask(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Tarea actualizada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar tarea"),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Tarea cancelada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al cancelar tarea"),
  });
}

export function useCompleteTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.completeTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Tarea completada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al completar tarea"),
  });
}

export function useReopenTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.reopenTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Tarea reabierta");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al reabrir tarea"),
  });
}

// Re-export type for pages
export type { HostingServiceFull };

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
import { settingsApi } from "./api-client";

const createSettingsHooks = (section: string) => {
  const useGet = () =>
    useQuery({
      queryKey: ["settings", section],
      queryFn: () => settingsApi[`get${section.charAt(0).toUpperCase()}${section.slice(1)}`](),
    });

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: Record<string, any>) =>
        settingsApi[`update${section.charAt(0).toUpperCase()}${section.slice(1)}`](data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["settings", section] });
        toast.success("Configuración guardada");
      },
      onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
    });
  };

  return { useGet, useUpdate };
};

export function useCompanySettings() {
  return useQuery({
    queryKey: ["settings", "company"],
    queryFn: () => settingsApi.getCompany(),
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateCompany(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "company"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}

export function useBillingSettings() {
  return useQuery({
    queryKey: ["settings", "billing"],
    queryFn: () => settingsApi.getBilling(),
  });
}

export function useUpdateBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateBilling(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "billing"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}

export function useHostingSettings() {
  return useQuery({
    queryKey: ["settings", "hosting"],
    queryFn: () => settingsApi.getHosting(),
  });
}

export function useUpdateHostingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateHosting(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "hosting"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["settings", "payments"],
    queryFn: () => settingsApi.getPayments(),
  });
}

export function useUpdatePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updatePayments(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "payments"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}

export function useEmailSettings() {
  return useQuery({
    queryKey: ["settings", "email"],
    queryFn: () => settingsApi.getEmail(),
  });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateEmail(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "email"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}

export function useWhatsappSettings() {
  return useQuery({
    queryKey: ["settings", "whatsapp"],
    queryFn: () => settingsApi.getWhatsapp(),
  });
}

export function useUpdateWhatsappSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateWhatsapp(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "whatsapp"] });
      toast.success("Configuración guardada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}
