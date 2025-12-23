import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface BusinessHoursScheduleProps {
  schedule: WeekSchedule;
  onChange: (schedule: WeekSchedule) => void;
}

const DAYS = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
] as const;

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const value = `${h}:${m}`;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const label = `${displayHour}:${m} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export function BusinessHoursSchedule({ schedule, onChange }: BusinessHoursScheduleProps) {
  const updateDay = (day: keyof WeekSchedule, updates: Partial<DaySchedule>) => {
    onChange({
      ...schedule,
      [day]: {
        ...schedule[day],
        ...updates,
      },
    });
  };

  const copyToAllDays = (sourceDay: keyof WeekSchedule) => {
    const source = schedule[sourceDay];
    const newSchedule = { ...schedule };
    DAYS.forEach(({ key }) => {
      newSchedule[key] = { ...source };
    });
    onChange(newSchedule);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">Business Hours Schedule</Label>
      </div>
      
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {DAYS.map(({ key, label, short }, index) => {
          const daySchedule = schedule[key];
          const isLast = index === DAYS.length - 1;
          
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                !isLast && "border-b border-border",
                daySchedule.enabled ? "bg-card" : "bg-muted/30"
              )}
            >
              {/* Day toggle */}
              <div className="flex items-center gap-3 min-w-[140px]">
                <Switch
                  checked={daySchedule.enabled}
                  onCheckedChange={(enabled) => updateDay(key, { enabled })}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={cn(
                  "font-medium text-sm transition-colors",
                  daySchedule.enabled ? "text-foreground" : "text-muted-foreground"
                )}>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </span>
              </div>

              {/* Time selectors */}
              <div className={cn(
                "flex items-center gap-2 flex-1 transition-opacity",
                !daySchedule.enabled && "opacity-40 pointer-events-none"
              )}>
                <Select
                  value={daySchedule.start}
                  onValueChange={(start) => updateDay(key, { start })}
                >
                  <SelectTrigger className="w-[110px] h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground text-sm">to</span>

                <Select
                  value={daySchedule.end}
                  onValueChange={(end) => updateDay(key, { end })}
                >
                  <SelectTrigger className="w-[110px] h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Copy to all button - only show on first enabled day */}
                {index === 0 && (
                  <button
                    type="button"
                    onClick={() => copyToAllDays(key)}
                    className="hidden md:inline-flex ml-2 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Copy to all
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Set your availability for each day. AI will handle calls outside these hours.
      </p>
    </div>
  );
}
