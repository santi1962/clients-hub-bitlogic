import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Wallet,
  Mail,
  Phone,
  Building2,
  CalendarDays,
  BadgeDollarSign,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";
import { getPlan, formatDate, formatMoney, formatPeriod } from "@/lib/mock-data";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  useClient,
  useClientServices,
  usePayments,
  useClientBillingSummary,
  useNotices,
  useDomains,
} from "@/lib/queries";

export const Route = createFileRoute("/_admin/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — Bitlogic" }] }),
  component: ClientDetail,
  notFoundComponent: () => <div className="p-8">Cliente no encontrado.</div>,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { data: client, isLoading, isError } = useClient(id);
  const { data: servicesData, isLoading: servicesLoading } = useClientServices(id);
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({ clientId: id });
  const { data: noticesData, isLoading: noticesLoading } = useNotices({ clientId: id });
  const { data: billingSummary } = useClientBillingSummary(id);
  const { data: domainsData, isLoading: domainsLoading } = useDomains({ clientId: id });

  const services = servicesData?.data ?? [];
  const pays = paymentsData?.data ?? [];
  const nots = (noticesData?.data ?? [])
    .slice()
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const domains = domainsData?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando cliente…</span>
        </div>
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Cliente no encontrado o error al cargar.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/clientes">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Clientes", to: "/clientes" }, { label: client.company || client.name }]}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.company || client.name}
            </h1>
            <p className="text-sm text-muted-foreground">{client.name}</p>
          </div>
          <StatusBadge status={client.status} className="ml-2" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit3 className="h-4 w-4" /> Editar
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Agregar servicio
          </Button>
          <Button>
            <Wallet className="h-4 w-4" /> Registrar pago
          </Button>
        </div>
      </div>

      {/* Top info grid */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" /> {client.company}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" /> {client.email}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" /> {client.phone || "—"}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" /> Cliente desde{" "}
              {formatDate(client.createdAt)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-success" /> Resumen financiero
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Servicios</p>
              <p className="mt-1 text-2xl font-semibold">{services.length}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Abonado histórico</p>
              <p className="mt-1 text-2xl font-semibold text-success">
                {formatMoney(billingSummary?.totalPaid ?? 0)}
              </p>
            </div>
            <div
              className={`rounded-lg border p-3 ${(billingSummary?.debt ?? 0) > 0 ? "border-destructive/40 bg-destructive/10" : "border-border/60 bg-background/40"}`}
            >
              <p className="text-[11px] uppercase text-muted-foreground flex items-center justify-center gap-1">
                {(billingSummary?.debt ?? 0) > 0 && (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}{" "}
                Deuda actual
              </p>
              <p
                className={`mt-1 text-2xl font-semibold ${(billingSummary?.debt ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {formatMoney(billingSummary?.debt ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Notas internas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground italic">
            {client.notes || "Sin notas registradas."}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">
            Servicios ({servicesLoading ? "…" : services.length})
          </TabsTrigger>
          <TabsTrigger value="domains">
            Dominios ({domainsLoading ? "…" : domains.length})
          </TabsTrigger>
          <TabsTrigger value="payments">Pagos ({paymentsLoading ? "…" : pays.length})</TabsTrigger>
          <TabsTrigger value="notices">Avisos ({noticesLoading ? "…" : nots.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-0">
              {servicesLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <EmptyState
                  title="Sin servicios contratados"
                  description="Agregá un servicio para empezar a facturarlo."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dominio</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.domain}</TableCell>
                        <TableCell>{s.planName ?? getPlan(s.planId)?.name ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell>{formatDate(s.nextDueDate)}</TableCell>
                        <TableCell className="text-right">{formatMoney(s.monthlyPrice)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/servicios/$id" params={{ id: s.id }}>
                              Ver
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-0">
              {domainsLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : domains.length === 0 ? (
                <EmptyState
                  title="Sin dominios registrados"
                  description="No hay dominios asociados a este cliente."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dominio</TableHead>
                      <TableHead>Registrador</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Auto renovar</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Precio anual</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domains.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.domain}</TableCell>
                        <TableCell>{d.registrar ?? "—"}</TableCell>
                        <TableCell>{formatDate(d.expirationDate)}</TableCell>
                        <TableCell>{d.autoRenew ? "Sí" : "No"}</TableCell>
                        <TableCell>
                          <StatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(d.customerPrice ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/dominios/$id" params={{ id: d.id }}>
                              Ver dominio
                            </Link>
                          </Button>
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
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : pays.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Sin pagos registrados"
                  description="No se encontraron pagos para este cliente."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° Aviso</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pays.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatPeriod(p.periodMonth)}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{formatDate(p.paidAt)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.noticeNumber ?? "—"}
                        </TableCell>
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

        <TabsContent value="notices">
          <Card className="border-border/60 bg-card/60">
            <CardContent className="p-0">
              {noticesLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : nots.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Sin avisos generados"
                  description="Generá avisos desde la sección Avisos o desde el workflow."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nots.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {n.noticeNumber}
                        </TableCell>
                        <TableCell>{formatPeriod(n.period)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {n.serviceDomain ?? "—"}
                        </TableCell>
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
      </Tabs>

      <ActivityTimeline title={`Actividad de ${client.name}`} filter={{ clientId: id }} />
    </div>
  );
}
