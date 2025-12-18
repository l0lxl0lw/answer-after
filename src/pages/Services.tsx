import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  AlertCircle,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

interface Service {
  id: number;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  afterHoursMultiplier: number;
  estimatedDuration: string;
  priority: "low" | "medium" | "high" | "emergency";
  availableDays: string[];
  availableHours: { start: string; end: string };
  isActive: boolean;
}

const initialServices: Service[] = [
  {
    id: 1,
    name: "Emergency Heating Repair",
    description: "24/7 emergency heating system repair and diagnostics",
    category: "Heating",
    basePrice: 250,
    afterHoursMultiplier: 1.5,
    estimatedDuration: "2-4 hours",
    priority: "emergency",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    availableHours: { start: "00:00", end: "23:59" },
    isActive: true,
  },
  {
    id: 2,
    name: "AC Maintenance",
    description: "Regular air conditioning maintenance and filter replacement",
    category: "Cooling",
    basePrice: 150,
    afterHoursMultiplier: 1.25,
    estimatedDuration: "1-2 hours",
    priority: "medium",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    availableHours: { start: "08:00", end: "18:00" },
    isActive: true,
  },
  {
    id: 3,
    name: "Thermostat Installation",
    description: "Smart thermostat installation and configuration",
    category: "Installation",
    basePrice: 200,
    afterHoursMultiplier: 1.0,
    estimatedDuration: "1-2 hours",
    priority: "low",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    availableHours: { start: "09:00", end: "17:00" },
    isActive: true,
  },
  {
    id: 4,
    name: "Plumbing Emergency",
    description: "Emergency pipe repair, leak detection, and water damage prevention",
    category: "Plumbing",
    basePrice: 300,
    afterHoursMultiplier: 1.75,
    estimatedDuration: "2-5 hours",
    priority: "emergency",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    availableHours: { start: "00:00", end: "23:59" },
    isActive: true,
  },
  {
    id: 5,
    name: "Duct Cleaning",
    description: "Complete air duct cleaning and sanitization service",
    category: "Maintenance",
    basePrice: 350,
    afterHoursMultiplier: 1.0,
    estimatedDuration: "3-4 hours",
    priority: "low",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    availableHours: { start: "08:00", end: "16:00" },
    isActive: false,
  },
];

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/20 text-primary",
  high: "bg-warning/20 text-warning",
  emergency: "bg-destructive/20 text-destructive",
};

const emptyService: Omit<Service, "id"> = {
  name: "",
  description: "",
  category: "",
  basePrice: 0,
  afterHoursMultiplier: 1.0,
  estimatedDuration: "",
  priority: "medium",
  availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  availableHours: { start: "09:00", end: "17:00" },
  isActive: true,
};

const Services = () => {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<Omit<Service, "id">>(emptyService);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const filteredServices = services.filter(
    (service) =>
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Service name is required";
    if (!formData.category.trim()) errors.category = "Category is required";
    if (formData.basePrice <= 0) errors.basePrice = "Price must be greater than 0";
    if (!formData.estimatedDuration.trim()) errors.estimatedDuration = "Duration is required";
    if (formData.availableDays.length === 0) errors.availableDays = "Select at least one day";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAdd = () => {
    setSelectedService(null);
    setFormData(emptyService);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      basePrice: service.basePrice,
      afterHoursMultiplier: service.afterHoursMultiplier,
      estimatedDuration: service.estimatedDuration,
      priority: service.priority,
      availableDays: service.availableDays,
      availableHours: service.availableHours,
      isActive: service.isActive,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (service: Service) => {
    setSelectedService(service);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = () => {
    if (!validateForm()) return;

    if (selectedService) {
      // Edit existing
      setServices((prev) =>
        prev.map((s) =>
          s.id === selectedService.id ? { ...s, ...formData } : s
        )
      );
      toast({
        title: "Service updated",
        description: `${formData.name} has been updated successfully.`,
      });
    } else {
      // Add new
      const newService: Service = {
        id: Math.max(...services.map((s) => s.id)) + 1,
        ...formData,
      };
      setServices((prev) => [...prev, newService]);
      toast({
        title: "Service added",
        description: `${formData.name} has been added successfully.`,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (!selectedService) return;
    setServices((prev) => prev.filter((s) => s.id !== selectedService.id));
    toast({
      title: "Service deleted",
      description: `${selectedService.name} has been deleted.`,
    });
    setIsDeleteDialogOpen(false);
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
              Services
            </h1>
            <p className="text-muted-foreground">
              Manage your service offerings, pricing, and availability.
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search services by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Services Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                All Services ({filteredServices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {service.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{service.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">${service.basePrice}</span>
                            {service.afterHoursMultiplier > 1 && (
                              <span className="text-xs text-muted-foreground">
                                ({service.afterHoursMultiplier}x after-hours)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{service.estimatedDuration}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityColors[service.priority]}>
                            {service.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={service.isActive ? "default" : "secondary"}
                          >
                            {service.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(service)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleOpenDelete(service)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredServices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <p className="text-muted-foreground">
                            No services found. Add your first service to get started.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {selectedService ? "Edit Service" : "Add New Service"}
              </DialogTitle>
              <DialogDescription>
                {selectedService
                  ? "Update the service details below."
                  : "Fill in the details to create a new service."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Service Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Emergency Heating Repair"
                    />
                    {formErrors.name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, category: e.target.value }))
                      }
                      placeholder="e.g., Heating, Cooling, Plumbing"
                    />
                    {formErrors.category && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.category}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Describe the service..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Pricing Rules
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price ($) *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.basePrice}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          basePrice: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    {formErrors.basePrice && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.basePrice}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="multiplier">After-Hours Multiplier</Label>
                    <Select
                      value={formData.afterHoursMultiplier.toString()}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          afterHoursMultiplier: parseFloat(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1.0x (No increase)</SelectItem>
                        <SelectItem value="1.25">1.25x</SelectItem>
                        <SelectItem value="1.5">1.5x</SelectItem>
                        <SelectItem value="1.75">1.75x</SelectItem>
                        <SelectItem value="2">2.0x (Double)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Estimated Duration *</Label>
                    <Input
                      id="duration"
                      value={formData.estimatedDuration}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          estimatedDuration: e.target.value,
                        }))
                      }
                      placeholder="e.g., 2-4 hours"
                    />
                    {formErrors.estimatedDuration && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.estimatedDuration}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Scheduling Constraints
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Available Days *</Label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            formData.availableDays.includes(day)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    {formErrors.availableDays && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {formErrors.availableDays}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.availableHours.start}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            availableHours: {
                              ...prev.availableHours,
                              start: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.availableHours.end}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            availableHours: {
                              ...prev.availableHours,
                              end: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority & Status */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Priority & Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority Level</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: "low" | "medium" | "high" | "emergency") =>
                        setFormData((prev) => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            isActive: checked === true,
                          }))
                        }
                      />
                      <Label
                        htmlFor="isActive"
                        className="font-normal cursor-pointer"
                      >
                        Service is active and available for booking
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {selectedService ? "Save Changes" : "Add Service"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedService?.name}"? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Services;
