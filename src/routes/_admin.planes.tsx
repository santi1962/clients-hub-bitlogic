import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Edit3, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { formatMoney, type Plan } from "@/lib/mock-data";
import { usePlans, useUpdatePlan, useCreatePlan, useDeletePlan } from "@/lib/queries";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/planes")({
  head: () => ({ meta: [{ title: "Planes — Bitlogic" }] }),
  component: PlansPage,
});

function PlansPage() {
  const { data, isLoading, isError } = usePlans();
  const updatePlanMutation = useUpdatePlan();
  const createPlanMutation = useCreatePlan();
  const deletePlanMutation = useDeletePlan();

  const plans = data?.data ?? [];
  const [editing, setEditing] = useState<Plan | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newPlanData, setNewPlanData] = useState({ name: "", monthlyPrice: 0 });

  const startEdit = (p: Plan) => {
    setEditing(p);
    setPrice(p.monthlyPrice);
  };
  const save = () => {
    if (!editing) return;
    updatePlanMutation.mutate(
      { id: editing.id, monthlyPrice: price },
      { onSuccess: () => setEditing(null) },
    );
  };

  const handleCreatePlan = () => {
    if (!newPlanData.name.trim()) {
      toast.error("Ingresa el nombre del plan");
      return;
    }
    createPlanMutation.mutate(newPlanData, {
      onSuccess: () => {
        setCreatingNew(false);
        setNewPlanData({ name: "", monthlyPrice: 0 });
      },
    });
  };

  const handleDeletePlan = (planId: string) => {
    if (confirm("¿Seguro que deseas eliminar este plan?")) {
      deletePlanMutation.mutate(planId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planes de hosting</h1>
          <p className="text-sm text-muted-foreground">Cargando planes…</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Planes de hosting</h1>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No se pudo cargar los planes. Verificá que el backend esté corriendo.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planes de hosting</h1>
          <p className="text-sm text-muted-foreground">
            Configurá los planes que ofrecés a tus clientes.
          </p>
        </div>
        <Button onClick={() => setCreatingNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo plan
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p, i) => (
          <Card
            key={p.id}
            className={
              "relative overflow-hidden border-border/60 bg-card/60 " +
              (i === 1 ? "ring-1 ring-primary/60 shadow-[0_0_30px_-15px_var(--color-primary)]" : "")
            }
          >
            {i === 1 && (
              <div className="absolute right-3 top-3 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                Más popular
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
              <p className="mt-1 text-3xl font-semibold">
                {formatMoney(p.monthlyPrice)}{" "}
                <span className="text-sm font-normal text-muted-foreground">/ mes</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" /> {p.storageGB} GB de almacenamiento
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" />
                  {p.sites === "ilimitados"
                    ? "Sitios ilimitados"
                    : p.sites === 1
                      ? "1 sitio"
                      : `${p.sites} sitios`}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" />
                  {p.emails === "ilimitados" ? "Correos ilimitados" : `${p.emails} correos`}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" /> Panel Hestia incluido
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" /> Certificado SSL gratis
                </li>
              </ul>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => startEdit(p)}>
                  <Edit3 className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeletePlan(p.id)}
                  disabled={deletePlanMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plan {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Precio mensual</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
                step={0.01}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={updatePlanMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={save} disabled={updatePlanMutation.isPending}>
              {updatePlanMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creatingNew} onOpenChange={setCreatingNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo plan</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nombre del plan</Label>
              <Input
                value={newPlanData.name}
                onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                placeholder="ej: Starter, Pro, Business"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Precio mensual</Label>
              <Input
                type="number"
                value={newPlanData.monthlyPrice}
                onChange={(e) => setNewPlanData({ ...newPlanData, monthlyPrice: Number(e.target.value) })}
                min={0}
                step={0.01}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreatingNew(false)}
              disabled={createPlanMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreatePlan} disabled={createPlanMutation.isPending}>
              {createPlanMutation.isPending ? "Creando…" : "Crear plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
