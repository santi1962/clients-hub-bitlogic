import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Repeat,
  FileText,
  Mail,
  HardDrive,
  User as UserIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { formatDate, formatMoney, formatPeriod } from "@/lib/mock-data";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  useService,
  useSuspendService,
  useReactivateService,
  useNotices,
  usePayments,
  useDomains,
} from "@/lib/queries";

export const Route = createFileRoute("/_admin/servicios/$id")({
  head: () => ({ meta: [{ title: "Servicio — Bitlogic" }] }),
  component: ServiceDetail,
  notFoundComponent: () => <div className="p-8">Servicio no encontrado.</div>,
});

function ConfirmAction({
  trigger,
  title,
  description,
  onConfirm,
  destructive,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ServiceDetail() {
  const { id } = Route.useParams();
  const { data: s, isLoading, isError } = useService(id);
  const suspendMutation = useSuspendService();
  const reactivateMutation = useReactivateService();
  const { data: noticesData, isLoading: noticesLoading } = useNotices({ serviceId: id });
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({ serviceId: id });
  const { data: domainsData, isLoading: domainsLoading } = useDomains({ serviceId: id });
  const serviceNotices = (noticesData?.data ?? [])
    .slice()
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const servicePayments = (paymentsData?.data ?? [])
    .slice()
    .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));
  const associatedDomain = (domainsData?.data ?? [])[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="md:col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !s) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Servicio no encontrado o error al cargar.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/servicios">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }

  const pctGB = Math.min(100, Math.round((s.usedGB / s.totalGB) * 100));
  const totalEmails = s.totalEmails;
  const pctMail =
    totalEmails === "ilimitados"
      ? 0
      : Math.min(100, Math.round((s.usedEmails / (totalEmails as number)) * 100));
  const isSuspended = s.status === "suspendido" || s.status === "cancelado";

  const handleSuspend = () => {
    suspendMutation.mutate(id);
  };

  const handleReactivate = () => {
    reactivateMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Servicios", to: "/servicios" }, { label: s.domain }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/servicios">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{s.domain}</h1>
            <p className="text-sm text-muted-foreground">
              Cliente:{" "}
              <Link
                to="/clientes/$id"
                params={{ id: s.clientId }}
                className="text-accent hover:underline"
              >
                {s.clientCompany ?? s.clientName ?? s.clientId}
              </Link>
            </p>
          </div>
          <StatusBadge status={s.status} className="ml-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfirmAction
            trigger={
              <Button
                variant="outline"
                disabled={suspendMutation.isPending || reactivateMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" /> Marcar pagado
              </Button>
            }
            title="Marcar pago como recibido"
            description={`Se registrará el pago del período actual para ${s.domain}.`}
            onConfirm={() => toast.success("Pago registrado (próximamente conectado al backend)")}
          />
          {isSuspended ? (
            <ConfirmAction
              trigger={
                <Button variant="outline" disabled={reactivateMutation.isPending}>
                  {reactivateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}{" "}
                  Reactivar
                </Button>
              }
              title="Reactivar servicio"
              description="El servicio volverá a estar activo y se generarán los avisos correspondientes."
              onConfirm={handleReactivate}
            />
          ) : (
            <ConfirmAction
              trigger={
                <Button variant="outline" disabled={suspendMutation.isPending}>
                  {suspendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}{" "}
                  Suspender
                </Button>
              }
              title="Suspender servicio"
              description="El cliente perderá el acceso al servicio hasta que se reactive."
              onConfirm={handleSuspend}
              destructive
            />
          )}
          <Button variant="outline">
            <Repeat className="h-4 w-4" /> Cambiar plan
          </Button>
          <Button onClick={() => toast.success("Aviso generado (próximamente conectado)")}>
            <FileText className="h-4 w-4" /> Generar aviso
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Información del hosting</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Dominio principal</p>
              <p className="font-medium">{s.domain}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan contratado</p>
              <p className="font-medium">{s.planName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha de alta</p>
              <p className="font-medium">{formatDate(s.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
              <p className="font-medium">{formatDate(s.nextDueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Precio mensual</p>
              <p className="font-medium">{formatMoney(s.monthlyPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuario Hestia</p>
              <p className="font-medium font-mono">{s.hestiaUser || "—"}</p>
            </div>

            <div className="col-span-2 mt-1 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" /> Espacio en disco
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Progress value={pctGB} className="h-2" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{pctGB}% utilizado</TooltipContent>
              </Tooltip>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.usedGB} GB / {s.totalGB} GB
              </p>
            </div>

            <div className="col-span-2 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Casillas de correo
              </p>
              {totalEmails === "ilimitados" ? (
                <p className="text-sm font-medium">
                  {s.usedEmails} casillas ·{" "}
                  <span className="text-muted-foreground font-normal">ilimitadas</span>
                </p>
              ) : (
                <>
                  <Progress value={pctMail} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.usedEmails} / {totalEmails} casillas
                  </p>
                </>
              )}
            </div>

            {s.notes && (
              <div className="col-span-2 border-t border-border/60 pt-3">
                <p className="text-xs text-muted-foreground mb-1">Observaciones internas</p>
                <p className="text-sm text-muted-foreground italic">{s.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-primary/15 via-card to-card">
          <CardHeader>
            <CardTitle className="text-base">Panel Hestia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Accedé al panel de control externo del servidor.
            </p>
            {s.hestiaUser ? (
              <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-accent" />
                  <span className="font-mono">{s.hestiaUser}</span>
                </div>
              </div>
            ) : null}
            {s.hestiaUrl ? (
              <>
                <Button asChild className="w-full">
                  <a href={s.hestiaUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Abrir Hestia
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground break-all">{s.hestiaUrl}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">URL de Hestia no configurada.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {domainsLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : associatedDomain ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Dominio asociado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Dominio</p>
              <p className="font-medium">{associatedDomain.domain}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registrador</p>
              <p className="font-medium">{associatedDomain.registrar ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vence</p>
              <p className="font-medium">{formatDate(associatedDomain.expirationDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auto renovación</p>
              <p className="font-medium">
                {associatedDomain.autoRenew ? "Activada" : "Desactivada"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <StatusBadge status={associatedDomain.status} />
            </div>
            <div className="flex items-end">
              <Button asChild size="sm" variant="outline">
                <Link to="/dominios/$id" params={{ id: associatedDomain.id }}>
                  Ver dominio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-6">
            <EmptyState
              title="Sin dominio asociado"
              description="Este servicio no tiene un dominio registrado en el sistema."
            />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="notices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notices">
            Avisos ({noticesLoading ? "…" : serviceNotices.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Pagos ({paymentsLoading ? "…" : servicePayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-0">
              {noticesLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : serviceNotices.length === 0 ? (
                <EmptyState
                  title="Sin avisos"
                  description="No hay avisos de pago asociados a este servicio."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceNotices.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {n.noticeNumber}
                        </TableCell>
                        <TableCell>{formatPeriod(n.period)}</TableCell>
                        <TableCell>{formatDate(n.issuedAt)}</TableCell>
                        <TableCell>{formatDate(n.dueAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={n.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(n.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-0">
              {paymentsLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : servicePayments.length === 0 ? (
                <EmptyState
                  title="Sin pagos"
                  description="No hay pagos registrados para este servicio."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Fecha pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicePayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatPeriod(p.periodMonth)}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{formatDate(p.paidAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ActivityTimeline title={`Actividad de ${s.domain}`} filter={{ serviceId: s.id }} />
    </div>
  );
}
