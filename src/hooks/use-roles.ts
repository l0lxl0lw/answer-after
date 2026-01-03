import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface ProviderRole {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleRequest {
  name: string;
}

export interface UpdateRoleRequest {
  id: string;
  name?: string;
  display_order?: number;
}

// ============================================
// HOOKS
// ============================================

/**
 * Fetch all roles for the current organization
 */
export function useRoles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["provider-roles", user?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_roles")
        .select("*")
        .order("display_order");

      if (error) throw error;
      return data as ProviderRole[];
    },
    enabled: !!user?.account_id,
  });
}

/**
 * Get usage count for a role (how many providers use it)
 */
export function useRoleUsageCount(roleId: string | undefined) {
  return useQuery({
    queryKey: ["role-usage", roleId],
    queryFn: async () => {
      if (!roleId) return 0;

      const { data, error } = await supabase.rpc("get_role_usage_count", {
        role_uuid: roleId,
      });

      if (error) throw error;
      return (data as number) || 0;
    },
    enabled: !!roleId,
  });
}

/**
 * Create a new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateRoleRequest) => {
      if (!user?.account_id) throw new Error("No organization");

      // Generate slug from name
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Get max display order
      const { data: roles } = await supabase
        .from("provider_roles")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1);

      const maxOrder = roles?.[0]?.display_order || 0;

      const { data: role, error } = await supabase
        .from("provider_roles")
        .insert({
          account_id: user.account_id,
          name: data.name.trim(),
          slug,
          is_default: false,
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return role as ProviderRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-roles"] });
      toast.success("Role created");
    },
    onError: (error) => {
      toast.error("Failed to create role", { description: error.message });
    },
  });
}

/**
 * Update an existing role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateRoleRequest) => {
      const updateData: Partial<ProviderRole> = {};

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
        // Update slug when name changes
        updateData.slug = data.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }

      if (data.display_order !== undefined) {
        updateData.display_order = data.display_order;
      }

      const { data: role, error } = await supabase
        .from("provider_roles")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return role as ProviderRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-roles"] });
      toast.success("Role updated");
    },
    onError: (error) => {
      toast.error("Failed to update role", { description: error.message });
    },
  });
}

/**
 * Delete a role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("provider_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-roles"] });
      // Also refresh providers as their role may now be null
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Role deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete role", { description: error.message });
    },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a URL-safe slug from a role name
 */
export function generateRoleSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
