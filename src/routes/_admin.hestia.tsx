import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server, RefreshCw, Eye, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { hestiaApi } from "@/lib/api-client";

export const Route = createFileRoute("/_admin/hestia")({
  head: () => ({ meta: [{ title: "HestiaCP — Bitlogic" }] }),
  component: HestiaPage,
});

interface HestiaUser {
  username: string;
  name: string;
  email: string;
  package: string;
  status: string;
  createdDate: string;
  login: string;
}

interface UserDetails {
  user: HestiaUser;
  domains: any[];
  stats: any;
}

function HestiaPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [users, setUsers] = useState<HestiaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [selectedUsername, setSelectedUsername] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Test connection
      const status = await hestiaApi.testStatus();
      setConnected(status.connected);

      if (status.connected) {
        // Load users
        const result = await hestiaApi.listUsers();
        setUsers(result.data);
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Error al conectar con HestiaCP");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserDetails(username: string) {
    try {
      setSelectedUsername(username);
      const details = await hestiaApi.getUser(username);
      setSelectedUser(details);
    } catch (err) {
      toast.error((err as Error).message ?? "Error al cargar usuario");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="HestiaCP"
        description="Integración con panel de hosting - Modo lectura"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Estado de conexión</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Probando conexión...</p>
            </div>
          ) : connected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-700">Conectado a HestiaCP</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-700">No conectado a HestiaCP</p>
            </div>
          )}
        </CardContent>
      </Card>

      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Usuarios detectados ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay usuarios en HestiaCP</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.username}>
                        <TableCell className="font-mono text-xs">{user.username}</TableCell>
                        <TableCell className="text-sm">{user.name}</TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell className="text-xs">{user.package}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{user.createdDate}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadUserDetails(user.username)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del usuario</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="font-mono font-medium">{selectedUser.user.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="font-medium">{selectedUser.user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedUser.user.package}</p>
                </div>
              </div>

              {selectedUser.stats && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Estadísticas</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Disco usado</p>
                      <p className="font-medium">{selectedUser.stats.diskUsed} MB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cuota disco</p>
                      <p className="font-medium">{selectedUser.stats.diskQuota} MB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cuentas email</p>
                      <p className="font-medium">{selectedUser.stats.emailAccounts}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bases de datos</p>
                      <p className="font-medium">{selectedUser.stats.databases}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedUser.domains && selectedUser.domains.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dominios ({selectedUser.domains.length})
                  </p>
                  <div className="space-y-1">
                    {selectedUser.domains.map((domain) => (
                      <div
                        key={domain.domain}
                        className="flex items-center justify-between rounded border border-border/40 px-2 py-1 text-xs"
                      >
                        <span className="font-mono">{domain.domain}</span>
                        <div className="flex gap-2">
                          {domain.ssl && <Badge variant="outline" className="text-xs">SSL</Badge>}
                          <Badge
                            variant={domain.status === "active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {domain.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
