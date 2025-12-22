import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Header } from "@/components/Header";
import { Loader2, Settings as SettingsIcon, Users, Shield, UserX } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  role: "admin" | "user";
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user, isAdmin, isLoading: roleLoading } = useRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "deactivate" | "role";
    userId: string;
    userName: string;
    newValue?: string;
  } | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
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
                    <TableHead className="text-right">Acciones</TableHead>
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
                        {new Date(userProfile.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
                        </div>
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
    </div>
  );
};

export default Settings;
