import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { format, addMinutes, parse } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
  generateTimeOptions,
} from "@/hooks/use-calendar";
import { useActiveProviders, type Provider } from "@/hooks/use-providers";
import { useServices } from "@/hooks/use-api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NewEventDialogProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  defaultTime?: string;
  defaultProviderId?: string;
}

interface FormData {
  title: string;
  provider_id: string;
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  description: string;
  status: "confirmed" | "tentative" | "cancelled";
}

export function NewEventDialog({
  open,
  onClose,
  event,
  defaultDate,
  defaultTime,
  defaultProviderId,
}: NewEventDialogProps) {
  const { data: providers } = useActiveProviders();
  const { data: services } = useServices();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const isEditing = !!event;
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      provider_id: "",
      date: format(new Date(), "yyyy-MM-dd"),
      start_time: "09:00",
      end_time: "09:30",
      customer_name: "",
      customer_phone: "",
      description: "",
      status: "confirmed",
    },
  });

  const selectedProviderId = watch("provider_id");
  const selectedStartTime = watch("start_time");
  const selectedDate = watch("date");

  // Initialize form with event data or defaults
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);

      reset({
        title: event.title,
        provider_id: event.provider_id || "",
        date: format(startDate, "yyyy-MM-dd"),
        start_time: format(startDate, "HH:mm"),
        end_time: format(endDate, "HH:mm"),
        customer_name: event.customer_name || "",
        customer_phone: event.customer_phone || "",
        description: event.description || "",
        status: event.status,
      });
    } else {
      // Set defaults for new event
      const date = defaultDate || new Date();
      const startTime = defaultTime || "09:00";

      // Calculate end time (30 min later by default)
      const startDateTime = parse(startTime, "HH:mm", date);
      const endDateTime = addMinutes(startDateTime, 30);

      reset({
        title: "",
        provider_id: defaultProviderId || "",
        date: format(date, "yyyy-MM-dd"),
        start_time: startTime,
        end_time: format(endDateTime, "HH:mm"),
        customer_name: "",
        customer_phone: "",
        description: "",
        status: "confirmed",
      });
    }
  }, [event, defaultDate, defaultTime, defaultProviderId, reset]);

  // Auto-adjust end time when start time changes
  useEffect(() => {
    if (!isEditing && selectedStartTime) {
      const dateForParsing = parse(selectedDate, "yyyy-MM-dd", new Date());
      const startDateTime = parse(selectedStartTime, "HH:mm", dateForParsing);
      const endDateTime = addMinutes(startDateTime, 30);
      setValue("end_time", format(endDateTime, "HH:mm"));
    }
  }, [selectedStartTime, selectedDate, setValue, isEditing]);

  const onSubmit = async (data: FormData) => {
    // Build datetime strings
    const startDateTime = `${data.date}T${data.start_time}:00`;
    const endDateTime = `${data.date}T${data.end_time}:00`;

    if (isEditing && event) {
      await updateEvent.mutateAsync({
        id: event.id,
        title: data.title,
        provider_id: data.provider_id || undefined,
        start_time: startDateTime,
        end_time: endDateTime,
        customer_name: data.customer_name || undefined,
        customer_phone: data.customer_phone || undefined,
        description: data.description || undefined,
        status: data.status,
      });
    } else {
      await createEvent.mutateAsync({
        title: data.title,
        provider_id: data.provider_id || undefined,
        start_time: startDateTime,
        end_time: endDateTime,
        customer_name: data.customer_name || undefined,
        customer_phone: data.customer_phone || undefined,
        description: data.description || undefined,
        status: data.status,
      });
    }

    onClose();
  };

  const handleDelete = async () => {
    if (event) {
      await deleteEvent.mutateAsync(event.id);
      onClose();
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    const service = services?.find((s) => s.id === serviceId);
    if (service) {
      setValue("title", service.name);

      // Adjust end time based on service duration
      if (service.duration_minutes && selectedStartTime) {
        const dateForParsing = parse(selectedDate, "yyyy-MM-dd", new Date());
        const startDateTime = parse(selectedStartTime, "HH:mm", dateForParsing);
        const endDateTime = addMinutes(startDateTime, service.duration_minutes);
        setValue("end_time", format(endDateTime, "HH:mm"));
      }
    }
  };

  const isPending =
    createEvent.isPending || updateEvent.isPending || deleteEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Appointment" : "New Appointment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Quick service selection */}
          {!isEditing && services && services.length > 0 && (
            <div className="space-y-2">
              <Label>Quick Select Service</Label>
              <Select onValueChange={handleServiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter((s) => s.is_active)
                    .map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration_minutes} min)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Dental Checkup"
              {...register("title", { required: "Title is required" })}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={selectedProviderId}
              onValueChange={(value) => setValue("provider_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {providers?.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: provider.color }}
                      />
                      {provider.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              {...register("date", { required: "Date is required" })}
            />
          </div>

          {/* Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Select
                value={selectedStartTime}
                onValueChange={(value) => setValue("start_time", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Select
                value={watch("end_time")}
                onValueChange={(value) => setValue("end_time", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                placeholder="John Doe"
                {...register("customer_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                placeholder="(555) 123-4567"
                {...register("customer_phone")}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              placeholder="Additional notes..."
              rows={2}
              {...register("description")}
            />
          </div>

          {/* Status (for editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value: "confirmed" | "tentative" | "cancelled") =>
                  setValue("status", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this appointment? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Appointment"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
