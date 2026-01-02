import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProviders,
  useDeleteProvider,
  type Provider,
} from "@/hooks/use-providers";
import { useRoles } from "@/hooks/use-roles";
import { ProviderForm } from "@/components/providers/ProviderForm";
import { ScheduleEditor } from "@/components/providers/ScheduleEditor";
import { RoleManager } from "@/components/providers/RoleManager";
import {
  Users,
  Plus,
  Pencil,
  Calendar,
  Trash2,
  Mail,
  Phone,
  MoreHorizontal,
  Settings2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function Providers() {
  const { data: providers, isLoading } = useProviders();
  const { data: roles = [] } = useRoles();
  const deleteProvider = useDeleteProvider();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [scheduleProvider, setScheduleProvider] = useState<Provider | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Provider | null>(null);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingProvider(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingProvider(null);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteProvider.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const getRoleName = (provider: Provider) => {
    // Use joined role_data if available, otherwise look up by role_id in roles array
    if (provider.role_data?.name) {
      return provider.role_data.name;
    }
    if (provider.role_id) {
      const role = roles.find((r) => r.id === provider.role_id);
      if (role) return role.name;
    }
    // Fallback to legacy role field
    return provider.role || "No Role";
  };

  const activeProviders = providers?.filter((p) => p.is_active) || [];
  const inactiveProviders = providers?.filter((p) => !p.is_active) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">
              Manage providers and their schedules
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRoleManagerOpen(true)} className="gap-2">
              <Settings2 className="w-4 h-4" />
              Manage Roles
            </Button>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Provider
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "-" : providers?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Providers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "-" : activeProviders.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading
                      ? "-"
                      : providers?.filter((p) => p.role === "dentist").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Dentists</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading
                      ? "-"
                      : providers?.filter((p) => p.role === "hygienist").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Hygienists</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Provider List */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Providers</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : providers && providers.length > 0 ? (
                <div className="space-y-3">
                  {providers.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onEdit={() => handleEdit(provider)}
                      onSchedule={() => setScheduleProvider(provider)}
                      onDelete={() => setDeleteConfirm(provider)}
                      getRoleName={getRoleName}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-1">No providers yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your team members to start managing schedules
                  </p>
                  <Button onClick={handleAdd} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add First Provider
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Provider Form Dialog */}
      <ProviderForm
        open={formOpen}
        onClose={handleFormClose}
        provider={editingProvider}
      />

      {/* Schedule Editor Dialog */}
      {scheduleProvider && (
        <ScheduleEditor
          open={!!scheduleProvider}
          onClose={() => setScheduleProvider(null)}
          provider={scheduleProvider}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteConfirm?.name}? This will also
              remove their schedule and any future appointments may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Manager Dialog */}
      <RoleManager
        open={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
      />
    </DashboardLayout>
  );
}

function ProviderCard({
  provider,
  onEdit,
  onSchedule,
  onDelete,
  getRoleName,
}: {
  provider: Provider;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  getRoleName: (provider: Provider) => string;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        provider.is_active
          ? "bg-card border-border"
          : "bg-muted/50 border-muted"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Color indicator */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: provider.color }}
        >
          {provider.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{provider.name}</span>
            <Badge variant="secondary">{getRoleName(provider)}</Badge>
            {!provider.is_active && (
              <Badge variant="outline" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {provider.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {provider.email}
              </span>
            )}
            {provider.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {provider.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSchedule}>
            <Calendar className="w-4 h-4 mr-2" />
            Edit Schedule
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
