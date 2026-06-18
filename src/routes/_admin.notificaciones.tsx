import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/notificaciones")({
  head: () => ({ meta: [{ title: "Notificaciones — Bitlogic" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
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

      <Card className="border-border/60">
        <CardContent className="p-0">
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Cuando ocurran eventos relevantes aparecerán aquí."
          />
        </CardContent>
      </Card>
    </div>
  );
}
