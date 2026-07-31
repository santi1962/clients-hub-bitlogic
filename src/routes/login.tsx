import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Ingresar — ${BRAND.appName}` }] }),
  component: LoginPage,
});

/**
 * El staff ya no tiene login propio acá — un solo login (Bitiando) para todo
 * el equipo. Esta pantalla solo redirige, y deja a mano el acceso al portal
 * de clientes (que sí conserva su login propio, sin SSO).
 */
function LoginPage() {
  const bitiandoUrl = import.meta.env.VITE_BITIANDO_URL ?? "http://localhost:3000";
  const bitiandoLoginUrl = `${bitiandoUrl}/login?next=${encodeURIComponent(window.location.origin + "/")}`;

  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = bitiandoLoginUrl;
    }, 800);
    return () => clearTimeout(t);
  }, [bitiandoLoginUrl]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between border-r border-border/60 p-10 lg:flex">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 128 128" className="h-10 w-10" xmlns="http://www.w3.org/2000/svg">
              <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 50 20 L 20 64 L 50 108"/>
                <path d="M 78 20 L 108 64 L 78 108"/>
              </g>
            </svg>
            <div className="flex items-center">
              <div className="text-2xl font-bold tracking-tight">{BRAND.companyName}</div>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              {BRAND.appName}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {BRAND.slogan}
            </p>
            <div className="grid max-w-md grid-cols-3 gap-3 pt-4">
              {["Hosting", "Dominios", "Cobranza", "Soporte", "Tareas", "Avisos"].map((t) => (
                <div
                  key={t}
                  className="rounded-lg border border-border/60 bg-card/30 px-3 py-2 text-center text-xs text-muted-foreground"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {BRAND.messages.copyright} · v{BRAND.version}
          </div>
        </div>

        {/* Redirect */}
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/60 bg-card/40 p-8 text-center shadow-xl backdrop-blur">
            <div className="space-y-1 text-center lg:hidden">
              <svg viewBox="0 0 128 128" className="mx-auto h-10 w-10" xmlns="http://www.w3.org/2000/svg">
                <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 35 20 L 10 64 L 35 108"/>
                  <path d="M 93 20 L 118 64 L 93 108"/>
                </g>
              </svg>
              <div className="pt-1 text-sm font-semibold">Bitlogic</div>
            </div>

            <div className="flex justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Redirigiendo…</h2>
              <p className="text-xs text-muted-foreground">
                El equipo ingresa con la cuenta única de Bitiando.
              </p>
            </div>

            <a
              href={bitiandoLoginUrl}
              className="inline-flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              Continuar ahora <ArrowRight className="h-4 w-4" />
            </a>

            <div className="border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
              ¿Sos cliente?{" "}
              <Link to="/portal" className="text-primary hover:underline">
                Acceder al portal del cliente
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
