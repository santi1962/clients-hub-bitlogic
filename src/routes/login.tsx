import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { authApi, setAccessToken } from "@/lib/api-client";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Ingresar — ${BRAND.appName}` }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Ingresá email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const { accessToken } = await authApi.login({ email, password, remember });
      setAccessToken(accessToken);
      toast.success(BRAND.messages.welcome);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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

        {/* Form */}
        <div className="flex items-center justify-center p-6">
          <form
            onSubmit={submit}
            className="w-full max-w-sm space-y-6 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-xl backdrop-blur"
          >
            <div className="space-y-1 text-center lg:hidden">
              <svg viewBox="0 0 128 128" className="mx-auto h-10 w-10" xmlns="http://www.w3.org/2000/svg">
                <g stroke="#2563eb" strokeWidth="16" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 35 20 L 10 64 L 35 108"/>
                  <path d="M 93 20 L 118 64 L 93 108"/>
                </g>
              </svg>
              <div className="pt-1 text-sm font-semibold">Bitlogic</div>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Ingresar al panel</h2>
              <p className="text-xs text-muted-foreground">Accedé con tu cuenta corporativa.</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9"
                    placeholder="tu@empresa.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pwd">Contraseña</Label>
                  <Link to="/recuperar" className="text-[11px] text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pwd"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="px-9"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Recordarme en este dispositivo
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Ingresando…"
              ) : (
                <>
                  Ingresar <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="space-y-2 border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
              <div>
                ¿Sos cliente?{" "}
                <Link to="/portal" className="text-primary hover:underline">
                  Acceder al portal del cliente
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
