"use client";
import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Search,
  Users,
  Server,
  Package,
  Wallet,
  FileText,
  LayoutDashboard,
  LineChart,
} from "lucide-react";
import { useClients, useServices } from "@/lib/queries";

const adminLinks = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Cobranza", url: "/cobranza", icon: LineChart },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Servicios", url: "/servicios", icon: Server },
  { title: "Planes", url: "/planes", icon: Package },
  { title: "Pagos", url: "/pagos", icon: Wallet },
  { title: "Avisos de pago", url: "/avisos", icon: FileText },
] as const;

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const { data: clientsData } = useClients({});
  const { data: servicesData } = useServices({});
  const clients = clientsData?.data ?? [];
  const services = servicesData?.data ?? [];

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (e.key === "/" && (e.target as HTMLElement)?.tagName === "INPUT") return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => setOpen(false), [pathname]);

  const go = (path: string, params?: Record<string, string>) => {
    setOpen(false);
    navigate({ to: path as never, params: params as never });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden md:flex h-9 w-[340px] items-center justify-between gap-2 border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" /> Buscar clientes, dominios, servicios...
        </span>
        <kbd className="ml-auto rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium">
          ⌘ K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar clientes, dominios, servicios..." />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup heading="Ir a">
            {adminLinks.map((l) => (
              <CommandItem key={l.url} value={l.title} onSelect={() => go(l.url)}>
                <l.icon className="h-4 w-4" /> {l.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Clientes">
            {clients.map((c) => (
              <CommandItem
                key={c.id}
                value={c.company + " " + c.name + " " + c.email}
                onSelect={() => go("/clientes/$id", { id: c.id })}
              >
                <Users className="h-4 w-4" />
                <div className="flex flex-col">
                  <span>{c.company}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.name} · {c.email}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Servicios">
            {services.map((s) => (
              <CommandItem
                key={s.id}
                value={s.domain}
                onSelect={() => go("/servicios/$id", { id: s.id })}
              >
                <Server className="h-4 w-4" /> {s.domain}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      {/* keep Link import for tree-shake safety */}
      <Link to="/" className="hidden" />
    </>
  );
}
