import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useToggleServiceStatus,
  SERVICE_CATEGORIES,
  formatPrice,
  formatDuration,
  getCategoryConfig,
  type Service,
} from "@/hooks/use-services";
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  MoreHorizontal,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
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

export default function MyServices() {
  const { data: services, isLoading } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const toggleStatus = useToggleServiceStatus();

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_cents: 0,
    duration_minutes: 60,
    category: "routine" as string,
    is_active: true,
  });

  // Derived state for price display (dollars)
  const [priceDisplay, setPriceDisplay] = useState("0");

  const handleAdd = () => {
    setEditingService(null);
    setFormData({
      name: "",
      description: "",
      price_cents: 0,
      duration_minutes: 60,
      category: "routine",
      is_active: true,
    });
    setPriceDisplay("0");
    setFormOpen(true);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price_cents: service.price_cents,
      duration_minutes: service.duration_minutes,
      category: service.category,
      is_active: service.is_active,
    });
    setPriceDisplay((service.price_cents / 100).toFixed(2));
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingService(null);
  };

  const handlePriceChange = (value: string) => {
    // Allow only numbers and decimal point
    const cleaned = value.replace(/[^\d.]/g, "");
    // Prevent multiple decimal points
    const parts = cleaned.split(".");
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
    setPriceDisplay(formatted);

    // Convert to cents
    const dollars = parseFloat(formatted) || 0;
    setFormData({ ...formData, price_cents: Math.round(dollars * 100) });
  };

  const handleSubmit = async () => {
    if (editingService) {
      await updateService.mutateAsync({
        id: editingService.id,
        ...formData,
      });
    } else {
      await createService.mutateAsync(formData);
    }
    handleFormClose();
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteService.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleToggleStatus = async (service: Service) => {
    await toggleStatus.mutateAsync({
      id: service.id,
      is_active: !service.is_active,
    });
  };

  const activeServices = services?.filter((s) => s.is_active) || [];
  const inactiveServices = services?.filter((s) => !s.is_active) || [];

  // Group services by category
  const groupedServices = services?.reduce((acc, service) => {
    const category = service.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>) || {};

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
            <h1 className="text-2xl font-bold tracking-tight">Services</h1>
            <p className="text-muted-foreground">
              Manage the services your business offers
            </p>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : services?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Services</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : activeServices.length}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "-" : services?.filter((s) => s.category === "emergency").length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Emergency</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "-" : inactiveServices.length}</p>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : services?.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No services yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first service to start managing your offerings
                </p>
                <Button onClick={handleAdd}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedServices).map(([category, categoryServices]) => {
              const config = getCategoryConfig(category);
              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={config.color}>{config.label}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {categoryServices.length} service{categoryServices.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {categoryServices.map((service) => (
                        <motion.div
                          key={service.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          <Card className={!service.is_active ? "opacity-60" : ""}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium truncate">{service.name}</h3>
                                    {!service.is_active && (
                                      <Badge variant="secondary" className="text-xs shrink-0">
                                        Inactive
                                      </Badge>
                                    )}
                                  </div>
                                  {service.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {service.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-1.5 text-sm">
                                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                                      <span className="font-medium">
                                        {formatPrice(service.price_cents)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                      <Clock className="w-4 h-4" />
                                      <span>{formatDuration(service.duration_minutes)}</span>
                                    </div>
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(service)}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleToggleStatus(service)}>
                                      {service.is_active ? (
                                        <>
                                          <XCircle className="w-4 h-4 mr-2" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          Activate
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteConfirm(service)}
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update service details" : "Create a new service offering"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Service name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="price"
                    value={priceDisplay}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="0.00"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })
                    }
                    placeholder="60"
                    className="pl-9"
                    min={1}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex flex-col">
                        <span>{cat.label}</span>
                        <span className="text-xs text-muted-foreground">{cat.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={!formData.name || createService.isPending || updateService.isPending}
            >
              {(createService.isPending || updateService.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingService ? "Save Changes" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirm?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteService.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
