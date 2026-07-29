import { Link } from "@tanstack/react-router";
import {
  Bell,
  AlertTriangle,
  Globe,
  CheckCircle2,
  XCircle,
  LifeBuoy,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { notifications } from "@/lib/notifications-data";
import { toast } from "sonner";

export function NotificationsBell() {
  const unread = notifications.filter((n) => n.state === "unread").length;
  const iconMap = {
    hosting_due: AlertTriangle,
    domain_due: Globe,
    payment_ok: CheckCircle2,
    payment_late: XCircle,
    ticket_new: LifeBuoy,
    task_assigned: ListChecks,
  } as const;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Notificaciones</p>
          <Badge variant="secondary" className="text-[10px]">
            {unread} sin leer
          </Badge>
        </div>
        <ScrollArea className="max-h-[420px]">
          <ul className="divide-y divide-border/60">
            {notifications.map((n) => {
              const Icon = iconMap[n.kind];
              return (
                <li
                  key={n.id}
                  className={
                    "flex gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer " +
                    (n.state === "unread" ? "bg-primary/[0.03]" : "")
                  }
                >
                  <div
                    className={
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
                      n.accent
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug">{n.title}</p>
                      {n.state === "unread" && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      {n.important && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-warning/40 text-warning"
                        >
                          !
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {n.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{n.time}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => toast.success("Todas marcadas como leídas")}
          >
            Marcar todas como leídas
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-xs h-7">
            <Link to="/notificaciones">Ver todas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
