import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Download, Loader2, HardDrive, Info, RefreshCw } from "lucide-react";
import { request, getAccessToken, API_BASE_URL } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/backups")({
  head: () => ({ meta: [{ title: "Backups — Bitlogic" }] }),
  component: BackupsPage,
});

interface BackupRecord {
  id: string;
  name: string;
  type: "database" | "files" | "full";
  size_mb: number;
  created_at: string;
  status: "success" | "failed" | "in_progress";
  notes?: string;
}

function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadBackups() {
    setLoading(true);
    try {
      const data = await request<BackupRecord[]>("/backups");
      setBackups(data);
    } catch {
      // silencioso, la tabla puede estar vacía
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBackups(); }, []);

  async function downloadBackup(backup: BackupRecord) {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE_URL}/backups/${backup.id}/download`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${backup.name}.sql`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar el backup");
    }
  }

  async function createBackup() {
    try {
      setCreating(true);
      await request("/backups", { method: "POST", body: { notes: "Backup bajo demanda" } });
      // esperar 2s para que el pg_dump tenga chance de iniciar
      await new Promise((r) => setTimeout(r, 2000));
      await loadBackups();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backups</h1>
          <p className="text-muted-foreground mt-2">Gestión de copias de seguridad del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button onClick={createBackup} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Crear Backup Ahora
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6 flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">Estrategia de Backups actual</p>
            <p className="text-sm text-blue-700 mt-1">
              • Manual: Backup de base de datos bajo demanda con el botón "Crear Backup Ahora"
              <br />• Ubicación: disco local del servidor (carpeta <code>backups/</code>), sin cifrado ni retención automática
              <br />• Recomendado: descargar y guardar cada backup en un lugar externo — ver sección "En desarrollo" más abajo para lo que falta (S3, programación automática, retención)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Almacenamiento Backups</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(backups.filter((b) => b.status === "success").reduce((s, b) => s + Number(b.size_mb), 0) / 1024).toFixed(1)} GB
            </div>
            <p className="text-xs text-muted-foreground">Solo backups exitosos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Backup</CardTitle>
          </CardHeader>
          <CardContent>
            {backups.length > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {new Date(backups[0].created_at).toLocaleDateString("es-AR")}
                </div>
                <p className="text-xs text-muted-foreground">{backups[0].name}</p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups.length}</div>
            <p className="text-xs text-muted-foreground">Registrados en el sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Backups List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Historial de Backups</h2>
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HardDrive className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay backups registrados. Creá el primero.</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{backup.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {backup.type === "database"
                          ? "Base de datos"
                          : backup.type === "files"
                            ? "Archivos"
                            : "Completo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{Number(backup.size_mb).toFixed(1)} MB</TableCell>
                    <TableCell className="text-sm">
                      {new Date(backup.created_at).toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={backup.status === "success" ? "default" : "destructive"}
                        className={
                          backup.status === "success" ? "bg-green-600" : "bg-red-600"
                        }
                      >
                        {backup.status === "success"
                          ? "Éxito"
                          : backup.status === "in_progress"
                            ? "En curso"
                            : "Error"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {backup.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={backup.status !== "success"}
                        onClick={() => downloadBackup(backup)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </Card>
      </div>

      {/* Plan de Mejora */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Plan de Implementación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✓ Estructura de backups en base de datos</p>
          <p>✓ Logs de ejecución</p>
          <p>• En desarrollo: Integración con AWS S3</p>
          <p>• En desarrollo: Programación automática (pg_cron)</p>
          <p>• En desarrollo: Restauración desde punto en tiempo</p>
        </CardContent>
      </Card>
    </div>
  );
}
