import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Server,
  Package,
  Wallet,
  FileText,
  Home,
  LineChart,
  ExternalLink,
  Globe,
  LifeBuoy,
  ListChecks,
  Workflow,
  Command,
  Shield,
  BookOpen,
  Sparkles,
  Bell,
  Settings,
  Mail,
} from "lucide-react";

import { useAuth, type Permission } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: any; perm: Permission };

const generalItems: NavItem[] = [
  { title: "Bienvenida", url: "/bienvenida", icon: Home, perm: "bienvenida" },
  { title: "Dashboard", url: "/", icon: LayoutDashboard, perm: "dashboard" },
  { title: "Centro de Operaciones", url: "/operaciones", icon: Command, perm: "operaciones" },
  { title: "Workflows", url: "/workflows", icon: Sparkles, perm: "workflows" },
  { title: "Cobranza", url: "/cobranza", icon: LineChart, perm: "cobranza" },
  { title: "Notificaciones", url: "/notificaciones", icon: Bell, perm: "notificaciones" },
];

const gestionItems: NavItem[] = [
  { title: "Clientes", url: "/clientes", icon: Users, perm: "clientes" },
  { title: "Servicios", url: "/servicios", icon: Server, perm: "servicios" },
  { title: "Dominios", url: "/dominios", icon: Globe, perm: "dominios" },
  { title: "Planes", url: "/planes", icon: Package, perm: "planes" },
];

const opsItems: NavItem[] = [
  { title: "Soporte", url: "/soporte", icon: LifeBuoy, perm: "soporte" },
  { title: "Tareas", url: "/tareas", icon: ListChecks, perm: "tareas" },
  { title: "Automatizaciones", url: "/automatizaciones", icon: Workflow, perm: "automatizaciones" },
];

const finanzasItems: NavItem[] = [
  { title: "Pagos", url: "/pagos", icon: Wallet, perm: "pagos" },
  { title: "Avisos de pago", url: "/avisos", icon: FileText, perm: "avisos" },
];

const adminItems: NavItem[] = [
  { title: "Usuarios y permisos", url: "/usuarios", icon: Shield, perm: "usuarios" },
  { title: "Configuración", url: "/configuracion", icon: Settings, perm: "configuracion" },
  { title: "Plantillas", url: "/plantillas", icon: Mail, perm: "plantillas" },
  { title: "Arquitectura Backend", url: "/arquitectura", icon: BookOpen, perm: "arquitectura" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { hasPermission } = useAuth();
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((i) => hasPermission(i.perm));
    if (!visible.length) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <svg viewBox="0 0 128 128" className="h-9 w-9" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 35 20 L 10 64 L 35 108"/>
              <path d="M 93 20 L 118 64 L 93 108"/>
            </g>
          </svg>
          <div className="flex items-center group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight">{BRAND.companyName}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("General", generalItems)}
        {renderGroup("Gestión", gestionItems)}
        {renderGroup("Operaciones", opsItems)}
        {renderGroup("Finanzas", finanzasItems)}
        {renderGroup("Administración", adminItems)}

        <SidebarGroup>
          <SidebarGroupLabel>Cliente</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/portal")}
                  tooltip="Portal del cliente"
                >
                  <Link to="/portal">
                    <ExternalLink />
                    <span>Portal del cliente</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          v1.1 · Bitlogic SaaS
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
