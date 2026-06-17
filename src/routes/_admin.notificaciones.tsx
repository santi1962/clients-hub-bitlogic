import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import {
  Bell,
  AlertTriangle,
  Globe,
  CheckCircle2,
  XCircle,
  LifeBuoy,
  ListChecks,
  CheckCheck,
} from "lucide-react";
import { notifications, type Notification } from "@/lib/notifications-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/notificaciones")({
  head: () => ({ meta: [{ title: "Notificaciones — Bitlogic" }] }),
  component: NotificationsPage,
});

const iconMap = {
  hosting_due: AlertTriangle,
  domain_due: Globe,
  payment_ok: CheckCircle2,
  payment_late: XCircle,
  ticket_new: LifeBuoy,
  task_assigned: ListChecks,
} as const;

function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const list = notifications.filter((n) =>
    filter === "all" ? true : filter === "unread" ? n.state === "unread" : n.important,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de notificaciones"
        description="Eventos recientes del sistema, pagos, vencimientos y soporte"
        actions={
          <Button variant="outline" size="sm" onClick={() => toast.success("Marcadas como leídas")}>
            <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas como leídas
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">
            No leídas ({notifications.filter((n) => n.state === "unread").length})
          </TabsTrigger>
          <TabsTrigger value="important">
            Importantes ({notifications.filter((n) => n.important).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {list.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Sin notificaciones"
              description="Cuando ocurran eventos relevantes aparecerán aquí."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {list.map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Item({ n }: { n: Notification }) {
  const Icon = iconMap[n.kind];
  return (
    <li
      className={
        "flex gap-4 px-5 py-4 hover:bg-muted/40 " +
        (n.state === "unread" ? "bg-primary/[0.03]" : "")
      }
    >
      <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " + n.accent}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{n.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {n.important && (
              <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                Importante
              </Badge>
            )}
            {n.state === "unread" && (
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                Nueva
              </Badge>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-1.5">{n.time}</p>
      </div>
    </li>
  );
}
