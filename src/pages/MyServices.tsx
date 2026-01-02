import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  AlertCircle,
  Zap,
  Settings2,
  Loader2,
  Crown,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RoleMultiSelect } from "@/components/providers/RoleMultiSelect";
import { useRoles } from "@/hooks/use-roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/use-api";
import { z } from "zod";
import { useNavigate } from "react-router-dom";

// Validation schema
const serviceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  price_cents: z.number().min(0, "Price must be positive"),
  duration_minutes: z.number().min(1, "Duration must be at least 1 minute").max(1440, "Duration too long"),
  category: z.enum(["routine", "emergency", "maintenance", "installation"]),
});

interface Service {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  category: string;
  provider_roles: string[] | null;
  is_active: boolean;
  organization_id: string;
  created_at: string;
}

interface FormData {
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  category: string;
  provider_roles: string[];
}

const emptyForm: FormData = {
  name: "",
  description: "",
  price_cents: 0,
  duration_minutes: 60,
  category: "routine",
  provider_roles: [],
};

const categoryConfig = {
  emergency: { label: "EMERGENCY", color: "bg-destructive text-destructive-foreground", icon: Zap },
  routine: { label: "ROUTINE", color: "bg-muted text-muted-foreground", icon: Settings2 },
  maintenance: { label: "MAINTENANCE", color: "bg-primary/20 text-primary", icon: Settings2 },
  installation: { label: "INSTALLATION", color: "bg-accent text-accent-foreground", icon: Settings2 },
};

const MyServices = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: roles = [] } = useRoles();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if plan has custom agent (services) access
  const { data: tierData, isLoading: tierLoading } = useQuery({
    queryKey: ['subscription-tier-services', subscription?.plan],
    queryFn: async () => {
      if (!subscription?.plan) return null;
      const { data } = await supabase
        .from('subscription_tiers')
        .select('has_custom_agent')
        .eq('plan_id', subscription.plan)
        .single();
      return data;
    },
    enabled: !!subscription?.plan,
  });

  const hasServicesAccess = tierData?.has_custom_agent === true;
  const isCheckingAccess = subLoading || tierLoading;

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!user && hasServicesAccess,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from("services").insert({
        organization_id: user?.organization_id,
        name: data.name.trim(),
        description: data.description.trim() || null,
        price_cents: data.price_cents,
        duration_minutes: data.duration_minutes,
        category: data.category,
        provider_roles: data.provider_roles,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Service created", description: "Your service has been added." });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const { error } = await supabase
        .from("services")
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          price_cents: data.price_cents,
          duration_minutes: data.duration_minutes,
          category: data.category,
          provider_roles: data.provider_roles,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Service updated", description: "Your changes have been saved." });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Service deleted", description: "The service has been removed." });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const validateForm = (): boolean => {
    const result = serviceSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0].toString()] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleOpenAdd = () => {
    setSelectedService(null);
    setFormData(emptyForm);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price_cents: service.price_cents,
      duration_minutes: service.duration_minutes,
      category: service.category,
      provider_roles: service.provider_roles || [],
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!validateForm()) return;
    if (selectedService) {
      updateMutation.mutate({ id: selectedService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (selectedService) {
      deleteMutation.mutate(selectedService.id);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Loading state
  if (isCheckingAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Feature gate - show upgrade prompt
  if (!hasServicesAccess) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Services</h1>
            <p className="text-muted-foreground">Define the services your AI agent can offer</p>
          </motion.div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Crown className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upgrade to Define Services</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Define custom services for your AI agent on Growth plans and above. Help the AI understand what you offer and validate customer requests.
              </p>
              <Button onClick={() => navigate("/dashboard/subscriptions")}>
                View Plans
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
              Services
            </h1>
            <p className="text-muted-foreground">
              The AI uses this list to validate customer requests.
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </motion.div>

        {/* Services Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Settings2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">No services yet</h3>
                <p className="text-muted-foreground text-sm">
                  Add your first service to help the AI understand what you offer.
                </p>
              </div>
              <Button onClick={handleOpenAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Service
              </Button>
            </div>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {services.map((service, index) => {
              const config = categoryConfig[service.category as keyof typeof categoryConfig] || categoryConfig.routine;
              const IconComponent = config.icon;

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="group relative hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                        service.category === "emergency" 
                          ? "bg-destructive/10" 
                          : "bg-muted"
                      }`}>
                        {service.category === "emergency" ? (
                          <Zap className="w-5 h-5 text-destructive" />
                        ) : (
                          <Settings2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-foreground mb-3 line-clamp-1">
                        {service.name}
                      </h3>

                      {/* Price & Duration */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Base Price:</span>
                          <span className="font-medium text-foreground">
                            {formatPrice(service.price_cents)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Est. Duration:</span>
                          <span className="font-medium text-foreground">
                            {formatDuration(service.duration_minutes)}
                          </span>
                        </div>
                      </div>

                      {/* Category Badge */}
                      <Badge className={config.color}>
                        {config.label}
                      </Badge>

                      {/* Assigned Roles */}
                      {service.provider_roles && service.provider_roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          <Users className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                          {service.provider_roles.map((roleSlug) => {
                            const role = roles.find((r) => r.slug === roleSlug);
                            return role ? (
                              <Badge key={roleSlug} variant="outline" className="text-xs">
                                {role.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}

                      {/* Actions (show on hover) */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(service)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedService(service);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedService ? "Edit Service" : "Add New Service"}
              </DialogTitle>
              <DialogDescription>
                {selectedService
                  ? "Update the service details below."
                  : "Define a service that the AI can offer to customers."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Emergency Pipe Repair"
                  maxLength={100}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the service..."
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Base Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={formData.price_cents / 100}
                    onChange={(e) =>
                      setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })
                    }
                    placeholder="95"
                  />
                  {formErrors.price_cents && (
                    <p className="text-sm text-destructive">{formErrors.price_cents}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (mins) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={1440}
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value || "60", 10) })
                    }
                    placeholder="60"
                  />
                  {formErrors.duration_minutes && (
                    <p className="text-sm text-destructive">{formErrors.duration_minutes}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Roles That Can Perform This Service</Label>
                <RoleMultiSelect
                  value={formData.provider_roles}
                  onChange={(roles) => setFormData({ ...formData, provider_roles: roles })}
                />
                <p className="text-xs text-muted-foreground">
                  Select which provider roles can perform this service
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedService ? "Save Changes" : "Create Service"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedService?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default MyServices;
