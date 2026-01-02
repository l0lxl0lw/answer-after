import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useProviderSchedule,
  useUpdateProviderSchedule,
  type Provider,
  type ScheduleEntry,
  formatDayOfWeek,
} from "@/hooks/use-providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScheduleEditorProps {
  open: boolean;
  onClose: () => void;
  provider: Provider;
}

interface DaySchedule {
  enabled: boolean;
  slots: { start: string; end: string }[];
}

type WeekSchedule = Record<number, DaySchedule>;

const TIME_OPTIONS = generateTimeOptions();

function generateTimeOptions() {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

const DEFAULT_SCHEDULE: WeekSchedule = {
  0: { enabled: false, slots: [] }, // Sunday
  1: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
  2: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
  3: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
  4: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
  5: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
  6: { enabled: false, slots: [] }, // Saturday
};

export function ScheduleEditor({ open, onClose, provider }: ScheduleEditorProps) {
  const { data: existingSchedule, isLoading } = useProviderSchedule(provider.id);
  const updateSchedule = useUpdateProviderSchedule();

  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  // Load existing schedule
  useEffect(() => {
    if (existingSchedule && existingSchedule.length > 0) {
      const loaded: WeekSchedule = { ...DEFAULT_SCHEDULE };

      // Reset all days to disabled first
      for (let i = 0; i < 7; i++) {
        loaded[i] = { enabled: false, slots: [] };
      }

      // Group by day
      existingSchedule.forEach((entry) => {
        const day = entry.day_of_week;
        if (!loaded[day]) {
          loaded[day] = { enabled: true, slots: [] };
        }
        loaded[day].enabled = entry.is_available;
        loaded[day].slots.push({
          start: entry.start_time.slice(0, 5), // Remove seconds
          end: entry.end_time.slice(0, 5),
        });
      });

      // Sort slots by start time
      for (let i = 0; i < 7; i++) {
        if (loaded[i].slots.length > 0) {
          loaded[i].enabled = true;
          loaded[i].slots.sort((a, b) => a.start.localeCompare(b.start));
        }
      }

      setSchedule(loaded);
    } else if (existingSchedule && existingSchedule.length === 0) {
      // No schedule exists, use default
      setSchedule(DEFAULT_SCHEDULE);
    }
  }, [existingSchedule]);

  const toggleDay = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        slots: !prev[day].enabled
          ? [{ start: "09:00", end: "17:00" }]
          : prev[day].slots,
      },
    }));
  };

  const addSlot = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [...prev[day].slots, { start: "09:00", end: "17:00" }],
      },
    }));
  };

  const removeSlot = (day: number, index: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((_, i) => i !== index),
      },
    }));
  };

  const updateSlot = (
    day: number,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    }));
  };

  const handleSave = async () => {
    const entries: ScheduleEntry[] = [];

    for (let day = 0; day < 7; day++) {
      const daySchedule = schedule[day];
      if (daySchedule.enabled && daySchedule.slots.length > 0) {
        daySchedule.slots.forEach((slot) => {
          entries.push({
            day_of_week: day,
            start_time: slot.start,
            end_time: slot.end,
            is_available: true,
          });
        });
      }
    }

    await updateSchedule.mutateAsync({
      providerId: provider.id,
      schedules: entries,
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Schedule for {provider.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <DayRow
                key={day}
                day={day}
                daySchedule={schedule[day]}
                onToggle={() => toggleDay(day)}
                onAddSlot={() => addSlot(day)}
                onRemoveSlot={(index) => removeSlot(day, index)}
                onUpdateSlot={(index, field, value) =>
                  updateSlot(day, index, field, value)
                }
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateSchedule.isPending}>
            {updateSchedule.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DayRow({
  day,
  daySchedule,
  onToggle,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
}: {
  day: number;
  daySchedule: DaySchedule;
  onToggle: () => void;
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  onUpdateSlot: (index: number, field: "start" | "end", value: string) => void;
}) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Switch checked={daySchedule.enabled} onCheckedChange={onToggle} />
          <Label className="font-medium">{formatDayOfWeek(day)}</Label>
        </div>
        {daySchedule.enabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddSlot}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Slot
          </Button>
        )}
      </div>

      {daySchedule.enabled && (
        <div className="space-y-2 pl-10">
          {daySchedule.slots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={slot.start}
                onValueChange={(value) => onUpdateSlot(index, "start", value)}
              >
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">to</span>
              <Select
                value={slot.end}
                onValueChange={(value) => onUpdateSlot(index, "end", value)}
              >
                <SelectTrigger className="w-[120px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {daySchedule.slots.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onRemoveSlot(index)}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!daySchedule.enabled && (
        <p className="text-sm text-muted-foreground pl-10">Not available</p>
      )}
    </div>
  );
}
