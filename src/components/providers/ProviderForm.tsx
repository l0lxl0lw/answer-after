import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, X } from "lucide-react";
import {
  useCreateProvider,
  useUpdateProvider,
  type Provider,
  PROVIDER_COLORS,
} from "@/hooks/use-providers";
import { useRoles, useCreateRole } from "@/hooks/use-roles";

interface ProviderFormProps {
  open: boolean;
  onClose: () => void;
  provider?: Provider | null;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  role_id: string;
  color: string;
  is_active: boolean;
}

export function ProviderForm({ open, onClose, provider }: ProviderFormProps) {
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const createRole = useCreateRole();
  const isEditing = !!provider;

  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role_id: "",
      color: PROVIDER_COLORS[0],
      is_active: true,
    },
  });

  const selectedColor = watch("color");
  const selectedRoleId = watch("role_id");
  const isActive = watch("is_active");

  // Reset form when provider changes or dialog opens/closes
  useEffect(() => {
    if (provider) {
      reset({
        name: provider.name,
        email: provider.email || "",
        phone: provider.phone || "",
        role_id: provider.role_id || (roles.length > 0 ? roles[0].id : ""),
        color: provider.color,
        is_active: provider.is_active,
      });
    } else {
      reset({
        name: "",
        email: "",
        phone: "",
        role_id: roles.length > 0 ? roles[0].id : "",
        color: PROVIDER_COLORS[0],
        is_active: true,
      });
    }
  }, [provider, reset, roles.length]); // Only depend on roles.length, not the whole array

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;

    const result = await createRole.mutateAsync({ name: newRoleName.trim() });
    setValue("role_id", result.id);
    setNewRoleName("");
    setShowAddRole(false);
  };

  const handleCancelAddRole = () => {
    setNewRoleName("");
    setShowAddRole(false);
  };

  const onSubmit = async (data: FormData) => {
    if (isEditing && provider) {
      await updateProvider.mutateAsync({
        id: provider.id,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        role_id: data.role_id,
        color: data.color,
        is_active: data.is_active,
      });
    } else {
      await createProvider.mutateAsync({
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        role_id: data.role_id,
        color: data.color,
        is_active: data.is_active,
      });
    }
    onClose();
  };

  const isPending = createProvider.isPending || updateProvider.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Provider" : "Add Provider"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Dr. Jane Smith"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Role *</Label>
            {showAddRole ? (
              <div className="flex gap-2">
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="New role name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRole();
                    } else if (e.key === "Escape") {
                      handleCancelAddRole();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddRole}
                  disabled={createRole.isPending || !newRoleName.trim()}
                >
                  {createRole.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelAddRole}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={selectedRoleId}
                  onValueChange={(value) => setValue("role_id", value)}
                  disabled={rolesLoading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddRole(true)}
                  title="Add new role"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@clinic.com"
              {...register("email")}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="(555) 123-4567"
              {...register("phone")}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Calendar Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PROVIDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Inactive providers won't appear in booking
              </p>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
