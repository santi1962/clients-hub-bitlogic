import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar")({
  head: () => ({ meta: [{ title: "Recuperar contraseña — Bitlogic" }] }),
  component: RecoverPage,
});

/**
 * BACKEND:
 *  - POST /api/auth/forgot-password { email }
 *  - Genera token único corto (15 min), guardado hasheado.
 *  - Envía email con link a /reset-password?token=...
 *  - Responder siempre 200 para no revelar emails existentes.
 */
function RecoverPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-6 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Bitlogic</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Recuperar acceso
            </div>
          </div>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Revisá tu correo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Si <span className="font-medium text-foreground">{email}</span> está registrado, te
                enviamos un enlace para restablecer tu contraseña. El enlace expira en 15 minutos.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al ingreso
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Recuperar contraseña</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ingresá el email de tu cuenta y te enviaremos instrucciones para restablecer tu
                contraseña.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="tu@empresa.com"
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              Enviar instrucciones
            </Button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Volver al ingreso
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
