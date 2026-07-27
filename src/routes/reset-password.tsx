import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Lock, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Restablecer contraseña — Bitlogic" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const weak = password.length > 0 && password.length < 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm || password.length < 8) return;
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "El enlace expiró o ya fue usado. Solicitá uno nuevo.");
    } finally {
      setLoading(false);
    }
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
              Nueva contraseña
            </div>
          </div>
        </div>

        {!token ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Enlace inválido</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Este enlace no contiene un token válido. Solicitá un nuevo enlace de recuperación.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/recuperar">
                <ArrowLeft className="mr-2 h-4 w-4" /> Recuperar contraseña
              </Link>
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Contraseña restablecida</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Tu contraseña fue actualizada correctamente. Ya podés ingresar con la nueva contraseña.
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
              Ir al ingreso
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Restablecer contraseña</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Elegí una contraseña segura de al menos 8 caracteres.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              {weak && (
                <p className="text-[11px] text-destructive">Mínimo 8 caracteres</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  placeholder="Repetí la contraseña"
                />
              </div>
              {mismatch && (
                <p className="text-[11px] text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || weak || mismatch || !password || !confirm}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
              ) : (
                "Guardar contraseña"
              )}
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
