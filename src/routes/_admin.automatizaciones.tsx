import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Mail, Loader2, Play, Trash2, X } from "lucide-react";
import { getAccessToken } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/automatizaciones")({
  head: () => ({ meta: [{ title: "Automatizaciones — Bitlogic" }] }),
  component: AutomatizacionesPage,
});

interface AutomationSetting {
  id: string;
  key: string;
  value: Record<string, any>;
  description: string;
  enabled: boolean;
  updated_at: string;
}

interface SchedulerJob {
  name: string;
  description: string;
}

interface SchedulerLog {
  id: string;
  job_name: string;
  status: "success" | "failed" | "running";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  summary: Record<string, any>;
  error_message?: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

const ALLOWED_REMINDERS = ["reminder_3_days", "reminder_7_days", "reminder_due_today"];
const RECIPIENT_SETTINGS = ["notification_recipients_admin", "notification_recipients_finance"];
const BLOCKED_SETTINGS = [
  "reminder_overdue_7days",
  "delinquency_create_task",
  "hestia_sync_enabled",
];

function AutomatizacionesPage() {
  const [settings, setSettings] = useState<AutomationSetting[]>([]);
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [logs, setLogs] = useState<SchedulerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [financeEmails, setFinanceEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newFinanceEmail, setNewFinanceEmail] = useState("");

  const token = getAccessToken();

  // Load data
  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  async function loadData() {
    try {
      setLoading(true);
      await Promise.all([
        loadSettings(),
        loadJobs(),
        loadLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/automation-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setSettings(data.data || []);

      // Extract emails
      const adminSetting = (data.data || []).find(
        (s: AutomationSetting) => s.key === "notification_recipients_admin"
      );
      const financeSetting = (data.data || []).find(
        (s: AutomationSetting) => s.key === "notification_recipients_finance"
      );

      setAdminEmails(adminSetting?.value?.emails || []);
      setFinanceEmails(financeSetting?.value?.emails || []);
    } catch (err) {
      addToast("Error al cargar configuraciones", "error");
    }
  }

  async function loadJobs() {
    try {
      const res = await fetch("/api/scheduler/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.data || []);
    } catch (err) {
      console.error("Error loading jobs:", err);
    }
  }

  async function loadLogs() {
    try {
      const res = await fetch("/api/scheduler/logs?limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(data.data || []);
    } catch (err) {
      console.error("Error loading logs:", err);
    }
  }

  async function toggleSetting(key: string, currentEnabled: boolean) {
    try {
      setToggling({ ...toggling, [key]: true });
      const res = await fetch(`/api/automation-settings/${key}/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to toggle setting");
      const data = await res.json();
      setSettings(settings.map((s) => (s.key === key ? data.data : s)));
      addToast(
        `${key} ${data.data.enabled ? "activado" : "desactivado"}`,
        "success"
      );
    } catch (err) {
      addToast("Error al cambiar configuración", "error");
    } finally {
      setToggling({ ...toggling, [key]: false });
    }
  }

  async function executeJob(jobName: string) {
    try {
      setExecuting({ ...executing, [jobName]: true });
      const res = await fetch(`/api/scheduler/jobs/${jobName}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to execute job");
      addToast("Job ejecutado correctamente", "success");
      await loadLogs();
    } catch (err) {
      addToast("Error al ejecutar job", "error");
    } finally {
      setExecuting({ ...executing, [jobName]: false });
    }
  }

  async function addRecipient(type: "admin" | "finance") {
    const email = type === "admin" ? newAdminEmail : newFinanceEmail;
    if (!email) return;

    try {
      const res = await fetch(`/api/automation-settings/notification_recipients_${type}/recipients`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to add recipient");
      if (type === "admin") {
        setAdminEmails([...adminEmails, email]);
        setNewAdminEmail("");
      } else {
        setFinanceEmails([...financeEmails, email]);
        setNewFinanceEmail("");
      }
      addToast("Email agregado", "success");
    } catch (err) {
      addToast("Error al agregar email", "error");
    }
  }

  async function removeRecipient(type: "admin" | "finance", email: string) {
    try {
      const res = await fetch(`/api/automation-settings/notification_recipients_${type}/recipients`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to remove recipient");
      if (type === "admin") {
        setAdminEmails(adminEmails.filter((e) => e !== email));
      } else {
        setFinanceEmails(financeEmails.filter((e) => e !== email));
      }
      addToast("Email eliminado", "success");
    } catch (err) {
      addToast("Error al eliminar email", "error");
    }
  }

  function addToast(message: string, type: "success" | "error" | "info") {
    const id = Date.now().toString();
    setToasts([...toasts, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automatizaciones</h1>
        <p className="text-muted-foreground mt-2">
          Controla los recordatorios automáticos y notificaciones del sistema
        </p>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg text-sm font-medium text-white shadow-lg ${
              toast.type === "success"
                ? "bg-green-500"
                : toast.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Recordatorios Permitidos */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Recordatorios de Pago</h2>
          <p className="text-sm text-muted-foreground">
            Envía emails automáticos recordando pagos próximos
          </p>
        </div>

        <div className="grid gap-4">
          {ALLOWED_REMINDERS.map((key) => {
            const setting = settings.find((s) => s.key === key);
            if (!setting) return null;

            const reminderId = key.replace("reminder_", "");
            const labels: Record<string, { name: string; desc: string }> = {
              "7_days": {
                name: "7 días antes",
                desc: "Recuerda cuando faltan 7 días para el vencimiento",
              },
              "3_days": {
                name: "3 días antes",
                desc: "Recuerda cuando faltan 3 días para el vencimiento",
              },
              due_today: {
                name: "Hoy vence",
                desc: "Recuerda el día del vencimiento",
              },
            };
            const label = labels[reminderId];

            return (
              <Card key={key}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="flex-1">
                    <CardTitle className="text-base">{label.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{label.desc}</p>
                  </div>
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={() => toggleSetting(key, setting.enabled)}
                    disabled={toggling[key]}
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={setting.enabled ? "default" : "secondary"}
                      className={
                        setting.enabled
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }
                    >
                      {setting.enabled ? "Activado" : "Desactivado"}
                    </Badge>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      <Mail className="h-3 w-3 mr-1" /> Solo email
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Última actualización:{" "}
                    {new Date(setting.updated_at).toLocaleString("es-AR")}
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs">
                    <AlertCircle className="h-3 w-3 mt-0.5 text-amber-600 flex-shrink-0" />
                    <div className="text-amber-800">
                      <strong>Seguro:</strong> Solo envía emails, nunca suspende servicios ni
                      modifica estados
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Destinatarios */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Destinatarios de Notificaciones</h2>
          <p className="text-sm text-muted-foreground">
            Emails que recibirán alertas sobre automaciones y errores
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Administrador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {adminEmails.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{email}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRecipient("admin", email)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="nuevo@email.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addRecipient("admin");
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => addRecipient("admin")}
                  disabled={!newAdminEmail}
                >
                  Agregar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Finance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tesorería</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {financeEmails.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{email}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRecipient("finance", email)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="nuevo@email.com"
                  value={newFinanceEmail}
                  onChange={(e) => setNewFinanceEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addRecipient("finance");
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => addRecipient("finance")}
                  disabled={!newFinanceEmail}
                >
                  Agregar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Jobs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Ejecutar Jobs Manualmente</h2>
          <p className="text-sm text-muted-foreground">
            Ejecuta los trabajos programados bajo demanda
          </p>
        </div>

        <div className="grid gap-4">
          {jobs.filter((j) => j.name.includes("payment_reminders")).map((job) => (
            <Card key={job.name}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">{job.description}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{job.name}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => executeJob(job.name)}
                  disabled={executing[job.name]}
                >
                  {executing[job.name] ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Ejecutar ahora
                    </>
                  )}
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Historial de Ejecuciones</h2>
          <p className="text-sm text-muted-foreground">
            Últimas 10 ejecuciones de jobs automáticos
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Job</th>
                <th className="text-left py-3 px-4 font-medium">Estado</th>
                <th className="text-left py-3 px-4 font-medium">Inicio</th>
                <th className="text-left py-3 px-4 font-medium">Duración</th>
                <th className="text-left py-3 px-4 font-medium">Resumen</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs">
                    {log.job_name.replace("_", " ")}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        log.status === "success"
                          ? "default"
                          : log.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className={
                        log.status === "success"
                          ? "bg-green-600"
                          : log.status === "failed"
                            ? "bg-red-600"
                            : ""
                      }
                    >
                      {log.status === "success"
                        ? "Éxito"
                        : log.status === "failed"
                          ? "Error"
                          : "Ejecutando"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {new Date(log.started_at).toLocaleString("es-AR")}
                  </td>
                  <td className="py-3 px-4 text-xs">{log.duration_ms}ms</td>
                  <td className="py-3 px-4">
                    <details className="cursor-pointer">
                      <summary className="text-xs font-mono text-blue-600 hover:underline">
                        {log.summary?.sent || log.summary?.scannedNotices || "—"}
                      </summary>
                      <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-auto max-w-md">
                        {JSON.stringify(
                          log.summary || log.error_message || {},
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Próximamente */}
      <div className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold">Próximamente</h2>
          <p className="text-sm text-muted-foreground">
            Automatizaciones adicionales en desarrollo
          </p>
        </div>

        <div className="grid gap-4">
          {BLOCKED_SETTINGS.map((key) => {
            const setting = settings.find((s) => s.key === key);
            if (!setting) return null;

            const labels: Record<string, string> = {
              reminder_overdue_7days: "Recordatorio de mora (7+ días vencido)",
              delinquency_create_task: "Crear tareas automáticas de cobranza",
              hestia_sync_enabled: "Sincronización automática con HestiaCP",
            };

            return (
              <Card key={key} className="opacity-60">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">{labels[key]}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                  </div>
                  <Badge variant="outline" className="bg-gray-100">
                    Próximamente
                  </Badge>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
