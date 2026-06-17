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
import { AlertCircle, Download, Loader2, HardDrive, Info } from "lucide-react";

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

const MOCK_BACKUPS: BackupRecord[] = [
  {
    id: "bk_001",
    name: "Backup Base de Datos",
    type: "database",
    size_mb: 245.5,
    created_at: "2026-06-17T14:30:00Z",
    status: "success",
    notes: "Backup automático diario",
  },
  {
    id: "bk_002",
    name: "Backup Completo",
    type: "full",
    size_mb: 1024.3,
    created_at: "2026-06-16T02:00:00Z",
    status: "success",
    notes: "Backup semanal programado",
  },
  {
    id: "bk_003",
    name: "Backup Base de Datos",
    type: "database",
    size_mb: 243.2,
    created_at: "2026-06-15T14:30:00Z",
    status: "success",
  },
];

function BackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>(MOCK_BACKUPS);
  const [creating, setCreating] = useState(false);

  async function createBackup() {
    try {
      setCreating(true);
      // Simulación - en producción llamaría al backend
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newBackup: BackupRecord = {
        id: `bk_${Date.now()}`,
        name: "Backup Base de Datos",
        type: "database",
        size_mb: Math.random() * 100 + 200,
        created_at: new Date().toISOString(),
        status: "success",
        notes: "Backup bajo demanda",
      };

      setBackups([newBackup, ...backups]);
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

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6 flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">Estrategia de Backups</p>
            <p className="text-sm text-blue-700 mt-1">
              • Diarios: Base de datos (automático a las 14:30 UTC)
              <br />• Semanales: Backup completo (sábados a las 02:00 UTC)
              <br />• Retención: 30 días
              <br />• Ubicación: AWS S3 (encriptado AES-256)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Storage Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Almacenamiento Usado</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4 GB</div>
            <p className="text-xs text-muted-foreground">De 100 GB disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Hoy</div>
            <p className="text-xs text-muted-foreground">Hace 3 horas 40 min</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups.length}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 días</p>
          </CardContent>
        </Card>
      </div>

      {/* Backups List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Historial de Backups</h2>
        <Card>
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
                    <TableCell>{backup.size_mb.toFixed(1)} MB</TableCell>
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
                      <Button size="sm" variant="ghost" disabled>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
