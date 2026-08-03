/**
 * React Query hooks — todas las entidades conectadas al backend real.
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
  usersApi,
  portalApi,
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
    mutationFn: (id: string) => plansApi.remove(id),
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

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => hostingApi.update(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Servicio ${data.domain} actualizado`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar servicio"),
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hostingApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Servicio eliminado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar servicio"),
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

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      paymentsApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pago actualizado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar pago"),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Pago eliminado correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar pago"),
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

export function useDeleteNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noticesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Aviso eliminado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar aviso"),
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

export function useDeleteTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => supportApi.deleteTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support"] });
      toast.success("Ticket eliminado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar ticket"),
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
      toast.success("Tarea eliminada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar tarea"),
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
// PORTAL USERS
// ─────────────────────────────────────────────────────────────
export function usePortalUsers() {
  return useQuery({
    queryKey: ["portalUsers"],
    queryFn: () => usersApi.listPortalUsers(),
    staleTime: 60_000,
  });
}

export function useCreatePortalUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { clientId: string; name: string; email: string; password: string }) =>
      usersApi.createPortalUser(data) as Promise<{ emailSent?: boolean }>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["portalUsers"] });
      toast.success(
        data?.emailSent
          ? "Acceso creado — le mandamos el link y la contraseña por email"
          : "Acceso creado, pero no se pudo mandar el email — copiá los datos y enviáselos a mano",
      );
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear acceso"),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      usersApi.resetPassword(userId, newPassword),
    onSuccess: () => toast.success("Contraseña restablecida"),
    onError: (err: Error) => toast.error(err.message ?? "Error al restablecer contraseña"),
  });
}

export function useDeletePortalUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.deletePortalUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portalUsers"] });
      toast.success("Acceso al portal eliminado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar acceso"),
  });
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
import { settingsApi } from "./api-client";

const createSettingsHooks = (section: string) => {
  const api = settingsApi as Record<string, (...args: any[]) => Promise<any>>;
  const useGet = () =>
    useQuery({
      queryKey: ["settings", section],
      queryFn: () => api[`get${section.charAt(0).toUpperCase()}${section.slice(1)}`](),
    });

  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: Record<string, any>) =>
        api[`update${section.charAt(0).toUpperCase()}${section.slice(1)}`](data),
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

// ─────────────────────────────────────────────────────────────
// PORTAL (cliente-facing)
// ─────────────────────────────────────────────────────────────
export function useMyClient() {
  return useQuery({
    queryKey: ["portal", "me"],
    queryFn: () => portalApi.getMyClient(),
    staleTime: 30_000,
  });
}

export function useMyServices() {
  return useQuery({
    queryKey: ["portal", "services"],
    queryFn: () => portalApi.getMyServices(),
    staleTime: 30_000,
  });
}

export function useMyDomains() {
  return useQuery({
    queryKey: ["portal", "domains"],
    queryFn: () => portalApi.getMyDomains(),
    staleTime: 30_000,
  });
}

export function useMyPayments() {
  return useQuery({
    queryKey: ["portal", "payments"],
    queryFn: () => portalApi.getMyPayments(),
    staleTime: 30_000,
  });
}

export function useMyNotices() {
  return useQuery({
    queryKey: ["portal", "notices"],
    queryFn: () => portalApi.getMyNotices(),
    staleTime: 30_000,
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: ["portal", "tickets"],
    queryFn: () => portalApi.getMyTickets(),
    staleTime: 15_000,
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; company?: string; phone?: string }) =>
      portalApi.updateMyProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal", "me"] });
      toast.success("Datos actualizados correctamente");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al guardar"),
  });
}
