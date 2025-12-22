import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { Loader2, Settings as SettingsIcon, Users, Shield, FolderOpen } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  role: "admin" | "user";
}

interface JobPosition {
  id: string;
  title: string;
}

interface JobAccessDialogState {
  open: boolean;
  userId: string;
  userName: string;
  assignedJobs: string[];
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: roleLoading } = useRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "deactivate" | "role";
    userId: string;
    userName: string;
    newValue?: string;
  } | null>(null);
  const [jobAccessDialog, setJobAccessDialog] = useState<JobAccessDialogState | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchJobPositions();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserProfile[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as "admin" | "user") || "user",
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: t("error"),
        description: "Error al cargar usuarios.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchJobPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, title")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setJobPositions(data || []);
    } catch (error: any) {
      console.error("Error fetching job positions:", error);
    }
  };

  const openJobAccessDialog = async (userProfile: UserProfile) => {
    try {
      const { data, error } = await supabase
        .from("user_job_access")
        .select("job_position_id")
        .eq("user_id", userProfile.user_id);
      
      if (error) throw error;

      setJobAccessDialog({
        open: true,
        userId: userProfile.user_id,
        userName: userProfile.full_name || userProfile.email,
        assignedJobs: data?.map((d) => d.job_position_id) || [],
      });
    } catch (error: any) {
      console.error("Error fetching job access:", error);
      toast({
        title: t("error"),
        description: "Error al cargar accesos.",
        variant: "destructive",
      });
    }
  };

  const toggleJobAccess = (jobId: string) => {
    if (!jobAccessDialog) return;
    setJobAccessDialog((prev) => {
      if (!prev) return prev;
      const exists = prev.assignedJobs.includes(jobId);
      return {
        ...prev,
        assignedJobs: exists
          ? prev.assignedJobs.filter((id) => id !== jobId)
          : [...prev.assignedJobs, jobId],
      };
    });
  };

  const saveJobAccess = async () => {
    if (!jobAccessDialog) return;
    setSavingAccess(true);
    try {
      // Delete all existing access for this user
      await supabase
        .from("user_job_access")
        .delete()
        .eq("user_id", jobAccessDialog.userId);

      // Insert new access entries
      if (jobAccessDialog.assignedJobs.length > 0) {
        const { error } = await supabase.from("user_job_access").insert(
          jobAccessDialog.assignedJobs.map((jobId) => ({
            user_id: jobAccessDialog.userId,
            job_position_id: jobId,
          }))
        );
        if (error) throw error;
      }

      toast({
        title: t("success"),
        description: "Accesos actualizados correctamente.",
      });
      setJobAccessDialog(null);
    } catch (error: any) {
      console.error("Error saving job access:", error);
      toast({
        title: t("error"),
        description: "Error al guardar accesos.",
        variant: "destructive",
      });
    } finally {
      setSavingAccess(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean, userName: string) => {
    setConfirmDialog({
      open: true,
      type: "deactivate",
      userId,
      userName,
      newValue: (!currentActive).toString(),
    });
  };

  const handleRoleChange = async (userId: string, newRole: string, userName: string) => {
    setConfirmDialog({
      open: true,
      type: "role",
      userId,
      userName,
      newValue: newRole,
    });
  };

  const confirmAction = async () => {
    if (!confirmDialog) return;

    try {
      if (confirmDialog.type === "deactivate") {
        const newActive = confirmDialog.newValue === "true";
        const { error } = await supabase
          .from("profiles")
          .update({ is_active: newActive })
          .eq("user_id", confirmDialog.userId);

        if (error) throw error;

        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === confirmDialog.userId ? { ...u, is_active: newActive } : u
          )
        );

        toast({
          title: t("success"),
          description: newActive
            ? "Usuario activado correctamente."
            : "Usuario desactivado correctamente.",
        });
      } else if (confirmDialog.type === "role") {
        const newRole = confirmDialog.newValue as "admin" | "user";
        
        // Check if role exists
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", confirmDialog.userId)
          .single();

        if (existingRole) {
          const { error } = await supabase
            .from("user_roles")
            .update({ role: newRole })
            .eq("user_id", confirmDialog.userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: confirmDialog.userId, role: newRole });
          if (error) throw error;
        }

        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === confirmDialog.userId ? { ...u, role: newRole } : u
          )
        );

        toast({
          title: t("success"),
          description: "Rol actualizado correctamente.",
        });
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: t("error"),
        description: "Error al actualizar usuario.",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog(null);
    }
  };

  if (roleLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            Configuración
          </h1>
          <p className="text-muted-foreground">
            Panel de administración del sistema
          </p>
        </div>

        {/* User Management */}
        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Users className="h-5 w-5 text-primary" />
              Gestión de Usuarios
            </CardTitle>
            <CardDescription>
              Administra los usuarios, asigna roles y controla el acceso al sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No hay usuarios registrados.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                        <TableHead>Acceso a Trabajos</TableHead>
                        <TableHead className="text-right">Activo</TableHead>
                      </TableRow>
                    </TableHeader>
                <TableBody>
                  {users.map((userProfile) => (
                    <TableRow key={userProfile.id}>
                      <TableCell className="font-medium">
                        {userProfile.full_name || "Sin nombre"}
                      </TableCell>
                      <TableCell>{userProfile.email}</TableCell>
                      <TableCell>
                        <Select
                          value={userProfile.role}
                          onValueChange={(value) =>
                            handleRoleChange(
                              userProfile.user_id,
                              value,
                              userProfile.full_name || userProfile.email
                            )
                          }
                          disabled={userProfile.user_id === user?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Usuario
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={userProfile.is_active ? "default" : "destructive"}
                        >
                          {userProfile.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userProfile.role === "user" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openJobAccessDialog(userProfile)}
                          >
                            <FolderOpen className="h-4 w-4 mr-1" />
                            Gestionar
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">Acceso completo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={userProfile.is_active}
                          onCheckedChange={() =>
                            handleToggleActive(
                              userProfile.user_id,
                              userProfile.is_active,
                              userProfile.full_name || userProfile.email
                            )
                          }
                          disabled={userProfile.user_id === user?.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog?.open}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "deactivate"
                ? confirmDialog?.newValue === "true"
                  ? "¿Activar usuario?"
                  : "¿Desactivar usuario?"
                : "¿Cambiar rol?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "deactivate"
                ? confirmDialog?.newValue === "true"
                  ? `¿Estás seguro de que deseas activar a "${confirmDialog.userName}"? El usuario podrá acceder al sistema.`
                  : `¿Estás seguro de que deseas desactivar a "${confirmDialog?.userName}"? El usuario no podrá acceder al sistema.`
                : `¿Estás seguro de que deseas cambiar el rol de "${confirmDialog?.userName}" a ${confirmDialog?.newValue === "admin" ? "Administrador" : "Usuario"}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Job Access Dialog */}
      <Dialog
        open={jobAccessDialog?.open}
        onOpenChange={(open) => !open && setJobAccessDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acceso a Trabajos</DialogTitle>
            <DialogDescription>
              Selecciona los trabajos que "{jobAccessDialog?.userName}" puede ver.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-4">
            {jobPositions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay trabajos disponibles.
              </p>
            ) : (
              jobPositions.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                >
                  <Checkbox
                    id={job.id}
                    checked={jobAccessDialog?.assignedJobs.includes(job.id) || false}
                    onCheckedChange={() => toggleJobAccess(job.id)}
                  />
                  <label
                    htmlFor={job.id}
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    {job.title}
                  </label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobAccessDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={saveJobAccess} disabled={savingAccess}>
              {savingAccess && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
