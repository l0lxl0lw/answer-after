import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type ProviderRole,
} from "@/hooks/use-roles";
import { supabase } from "@/lib/supabase";
import { Pencil, Trash2, Plus, AlertTriangle, Loader2 } from "lucide-react";

interface RoleManagerProps {
  open: boolean;
  onClose: () => void;
}

export function RoleManager({ open, onClose }: RoleManagerProps) {
  const { data: roles = [], isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [newRoleName, setNewRoleName] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    role: ProviderRole;
    usageCount: number;
  } | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);

  const handleCreate = async () => {
    if (!newRoleName.trim()) return;
    await createRole.mutateAsync({ name: newRoleName.trim() });
    setNewRoleName("");
  };

  const handleStartEdit = (role: ProviderRole) => {
    setEditingRole(role.id);
    setEditName(role.name);
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setEditName("");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateRole.mutateAsync({ id, name: editName.trim() });
    setEditingRole(null);
    setEditName("");
  };

  const handleDeleteClick = async (role: ProviderRole) => {
    setCheckingUsage(true);
    try {
      // Check usage count before confirming
      const { data: count } = await supabase.rpc("get_role_usage_count", {
        role_uuid: role.id,
      });
      setDeleteConfirm({ role, usageCount: count || 0 });
    } finally {
      setCheckingUsage(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteRole.mutateAsync(deleteConfirm.role.id);
    setDeleteConfirm(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              Add, edit, or remove provider roles for your organization.
            </DialogDescription>
          </DialogHeader>

          {/* Add new role */}
          <div className="flex gap-2">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="New role name..."
              onKeyDown={(e) => handleKeyDown(e, handleCreate)}
              disabled={createRole.isPending}
            />
            <Button
              onClick={handleCreate}
              disabled={createRole.isPending || !newRoleName.trim()}
            >
              {createRole.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </div>

          {/* Roles list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No roles defined yet. Add your first role above.
              </p>
            ) : (
              roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                >
                  {editingRole === role.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) =>
                          handleKeyDown(e, () => handleUpdate(role.id))
                        }
                        autoFocus
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(role.id)}
                        disabled={updateRole.isPending || !editName.trim()}
                      >
                        {updateRole.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <Badge variant="secondary">{role.name}</Badge>
                        {role.is_default && (
                          <span className="text-xs text-muted-foreground">
                            (default)
                          </span>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(role)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(role)}
                        disabled={checkingUsage}
                      >
                        {checkingUsage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation with warning if in use */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteConfirm?.usageCount ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : null}
              Delete Role
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.usageCount ? (
                <>
                  <strong>Warning:</strong> This role is currently assigned to{" "}
                  <strong>{deleteConfirm.usageCount}</strong> provider
                  {deleteConfirm.usageCount === 1 ? "" : "s"}. Deleting it will
                  remove the role from those providers.
                </>
              ) : (
                <>
                  Are you sure you want to delete "{deleteConfirm?.role.name}"?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRole.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
