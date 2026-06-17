import {
  UserPlus,
  Server,
  AlertTriangle,
  RotateCw,
  ArrowUpRight,
  FileText,
  Wallet,
  LifeBuoy,
  Globe,
  ListChecks,
  Mail,
  Activity,
} from "lucide-react";
import { useActivity, type ActivityEvent, type ActivityKind } from "@/lib/activity-log";

const ICON: Record<ActivityKind, { icon: any; color: string }> = {
  client_created: { icon: UserPlus, color: "bg-sky-500/15 text-sky-300" },
  service_created: { icon: Server, color: "bg-emerald-500/15 text-emerald-300" },
  service_suspended: { icon: AlertTriangle, color: "bg-rose-500/15 text-rose-300" },
  service_reactivated: { icon: RotateCw, color: "bg-emerald-500/15 text-emerald-300" },
  service_plan_changed: { icon: ArrowUpRight, color: "bg-violet-500/15 text-violet-300" },
  payment_notice_created: { icon: FileText, color: "bg-amber-500/15 text-amber-300" },
  payment_registered: { icon: Wallet, color: "bg-emerald-500/15 text-emerald-300" },
  ticket_created: { icon: LifeBuoy, color: "bg-amber-500/15 text-amber-300" },
  domain_renewed: { icon: Globe, color: "bg-sky-500/15 text-sky-300" },
  task_created: { icon: ListChecks, color: "bg-primary/15 text-primary" },
  access_sent: { icon: Mail, color: "bg-violet-500/15 text-violet-300" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTimeline({
  filter,
  limit,
  emptyLabel = "Sin actividad registrada todavía.",
  title = "Actividad reciente",
}: {
  filter?: Partial<NonNullable<ActivityEvent["refs"]>>;
  limit?: number;
  emptyLabel?: string;
  title?: string;
}) {
  const events = useActivity(filter);
  const items = limit ? events.slice(0, limit) : events;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{events.length} eventos</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border/60" />
          {items.map((e) => {
            const { icon: Icon, color } = ICON[e.kind];
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-5 top-0 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-card/40 ${color}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatTime(e.createdAt)}
                    </span>
                  </div>
                  {e.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    por {e.actor}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
