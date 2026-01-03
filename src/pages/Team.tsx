import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useProviders,
  useCreateProvider,
  useUpdateProvider,
  useDeleteProvider,
  useProviderSchedule,
  useUpdateProviderSchedule,
  PROVIDER_COLORS,
  formatDayOfWeek,
  type Provider,
  type ScheduleEntry,
} from "@/hooks/use-providers";
import { useRoles, useCreateRole, useDeleteRole, type ProviderRole } from "@/hooks/use-roles";
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
  X,
  Check,
  Clock,
  Loader2,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSyncProvidersFromNexHealth } from "@/hooks/use-providers";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Default schedule template (Mon-Fri 9-5)
const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_available: true },
  { day_of_week: 2, start_time: "09:00", end_time: "17:00", is_available: true },
  { day_of_week: 3, start_time: "09:00", end_time: "17:00", is_available: true },
  { day_of_week: 4, start_time: "09:00", end_time: "17:00", is_available: true },
  { day_of_week: 5, start_time: "09:00", end_time: "17:00", is_available: true },
];

export default function Team() {
  const { user } = useAuth();
  const { data: providers, isLoading } = useProviders();
  const { data: roles = [] } = useRoles();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const syncFromNexHealth = useSyncProvidersFromNexHealth();

  // Check if NexHealth is enabled
  const { data: accountData } = useQuery({
    queryKey: ["account-nexhealth", user?.account_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("nexhealth_enabled")
        .eq("id", user?.account_id)
        .single();
      return data;
    },
    enabled: !!user?.account_id,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [scheduleProvider, setScheduleProvider] = useState<Provider | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Provider | null>(null);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role_id: "",
    color: PROVIDER_COLORS[0],
    is_active: true,
  });
  const [isAddingNewRole, setIsAddingNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const createRole = useCreateRole();

  const handleAdd = () => {
    setEditingProvider(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      role_id: "",
      color: PROVIDER_COLORS[providers?.length || 0 % PROVIDER_COLORS.length],
      is_active: true,
    });
    setIsAddingNewRole(false);
    setNewRoleName("");
    // If no roles exist, automatically show the "add new role" field
    if (roles.length === 0) {
      setIsAddingNewRole(true);
    }
    setFormOpen(true);
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      email: provider.email || "",
      phone: provider.phone || "",
      role_id: provider.role_id || "",
      color: provider.color || PROVIDER_COLORS[0],
      is_active: provider.is_active,
    });
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingProvider(null);
    setIsAddingNewRole(false);
    setNewRoleName("");
  };

  const handleAddNewRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const newRole = await createRole.mutateAsync({ name: newRoleName.trim() });
      setFormData({ ...formData, role_id: newRole.id });
      setIsAddingNewRole(false);
      setNewRoleName("");
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleSubmit = async () => {
    if (editingProvider) {
      await updateProvider.mutateAsync({
        id: editingProvider.id,
        ...formData,
      });
    } else {
      await createProvider.mutateAsync(formData);
    }
    handleFormClose();
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteProvider.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const getRoleName = (provider: Provider) => {
    if (provider.role_data?.name) return provider.role_data.name;
    if (provider.role_id) {
      const role = roles.find((r) => r.id === provider.role_id);
      if (role) return role.name;
    }
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
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">
              Manage your team members and their schedules
            </p>
          </div>
          <div className="flex gap-2">
            {accountData?.nexhealth_enabled && (
              <Button
                variant="outline"
                onClick={() => syncFromNexHealth.mutate()}
                disabled={syncFromNexHealth.isPending}
                className="gap-2"
              >
                {syncFromNexHealth.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync from PMS
              </Button>
            )}
            <Button variant="outline" onClick={() => setRoleManagerOpen(true)} className="gap-2">
              <Settings2 className="w-4 h-4" />
              Roles
            </Button>
            <Button onClick={handleAdd} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : providers?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : activeProviders.length}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{roles.length}</p>
                  <p className="text-xs text-muted-foreground">Roles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <X className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : inactiveProviders.length}</p>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : providers?.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No team members yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first team member to start managing schedules
                </p>
                <Button onClick={handleAdd}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {providers?.map((provider, index) => (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={!provider.is_active ? "opacity-60" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg"
                          style={{ backgroundColor: provider.color || PROVIDER_COLORS[0] }}
                        >
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{provider.name}</h3>
                            {!provider.is_active && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {getRoleName(provider)}
                          </Badge>
                          {provider.email && (
                            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="truncate">{provider.email}</span>
                            </div>
                          )}
                          {provider.phone && (
                            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{provider.phone}</span>
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(provider)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setScheduleProvider(provider)}>
                              <Calendar className="w-4 h-4 mr-2" />
                              Schedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(provider)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? "Edit Member" : "Add Member"}</DialogTitle>
            <DialogDescription>
              {editingProvider ? "Update team member details" : "Add a new team member"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              {isAddingNewRole ? (
                <div className="flex gap-2">
                  <Input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Enter role name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewRole();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddNewRole}
                    disabled={!newRoleName.trim() || createRole.isPending}
                  >
                    {createRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingNewRole(false);
                      setNewRoleName("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.role_id}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setIsAddingNewRole(true);
                    } else {
                      setFormData({ ...formData, role_id: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add new role...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PROVIDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleFormClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.role_id || createProvider.isPending || updateProvider.isPending}
            >
              {(createProvider.isPending || updateProvider.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingProvider ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <ScheduleDialog
        provider={scheduleProvider}
        onClose={() => setScheduleProvider(null)}
      />

      {/* Role Manager Dialog */}
      <RoleManagerDialog
        open={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
        roles={roles}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteConfirm?.name} and their schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProvider.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// Schedule Dialog Component
function ScheduleDialog({
  provider,
  onClose,
}: {
  provider: Provider | null;
  onClose: () => void;
}) {
  const { data: existingSchedule } = useProviderSchedule(provider?.id);
  const updateSchedule = useUpdateProviderSchedule();

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  // Initialize schedule when provider changes
  useState(() => {
    if (existingSchedule && existingSchedule.length > 0) {
      setSchedule(existingSchedule.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_available: s.is_available,
      })));
    } else if (provider) {
      setSchedule(DEFAULT_SCHEDULE);
    }
  });

  // Update schedule when data loads
  if (existingSchedule && existingSchedule.length > 0 && schedule.length === 0) {
    setSchedule(existingSchedule.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_available: s.is_available,
    })));
  } else if (existingSchedule?.length === 0 && schedule.length === 0 && provider) {
    setSchedule(DEFAULT_SCHEDULE);
  }

  const handleSave = async () => {
    if (!provider) return;
    await updateSchedule.mutateAsync({
      providerId: provider.id,
      schedules: schedule.filter((s) => s.is_available),
    });
    onClose();
  };

  const updateDay = (dayOfWeek: number, field: keyof ScheduleEntry, value: any) => {
    setSchedule((prev) =>
      prev.map((s) =>
        s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
  };

  const toggleDay = (dayOfWeek: number) => {
    const existing = schedule.find((s) => s.day_of_week === dayOfWeek);
    if (existing) {
      updateDay(dayOfWeek, "is_available", !existing.is_available);
    } else {
      setSchedule((prev) => [
        ...prev,
        { day_of_week: dayOfWeek, start_time: "09:00", end_time: "17:00", is_available: true },
      ]);
    }
  };

  const days = [0, 1, 2, 3, 4, 5, 6]; // Sunday to Saturday

  return (
    <Dialog open={!!provider} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule - {provider?.name}</DialogTitle>
          <DialogDescription>
            Set availability for each day of the week
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {days.map((day) => {
            const entry = schedule.find((s) => s.day_of_week === day);
            const isAvailable = entry?.is_available ?? false;

            return (
              <div key={day} className="flex items-center gap-3">
                <div className="w-20">
                  <span className="text-sm font-medium">{formatDayOfWeek(day)}</span>
                </div>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={() => toggleDay(day)}
                />
                {isAvailable && entry && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={entry.start_time}
                      onChange={(e) => updateDay(day, "start_time", e.target.value)}
                      className="w-28 h-8"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={entry.end_time}
                      onChange={(e) => updateDay(day, "end_time", e.target.value)}
                      className="w-28 h-8"
                    />
                  </div>
                )}
                {!isAvailable && (
                  <span className="text-sm text-muted-foreground">Off</span>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateSchedule.isPending}>
            {updateSchedule.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Role Manager Dialog
function RoleManagerDialog({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: ProviderRole[];
}) {
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();
  const [newRoleName, setNewRoleName] = useState("");
  const [deletingRole, setDeletingRole] = useState<ProviderRole | null>(null);

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    await createRole.mutateAsync({ name: newRoleName.trim() });
    setNewRoleName("");
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    await deleteRole.mutateAsync(deletingRole.id);
    setDeletingRole(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              Create and manage roles for your team members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="New role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRole()}
              />
              <Button onClick={handleAddRole} disabled={!newRoleName.trim() || createRole.isPending}>
                {createRole.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between p-2 rounded-lg border"
                >
                  <span className="font-medium">{role.name}</span>
                  {!role.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingRole(role)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {roles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No roles yet. Add your first role above.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the "{deletingRole?.name}" role. Team members with this role will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
