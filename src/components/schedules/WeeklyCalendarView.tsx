import { useMemo, useState } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WeekSchedule } from '@/components/settings/BusinessHoursSchedule';

interface WeeklyCalendarViewProps {
  businessHours: WeekSchedule | null;
  timezone?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_KEYS: (keyof WeekSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToHour(time: string): number {
  const [h] = time.split(':').map(Number);
  return h;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function WeeklyCalendarView({ businessHours, timezone }: WeeklyCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
  
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const today = new Date();

  const isHourAvailable = (dayIndex: number, hour: number): boolean => {
    if (!businessHours) return true;
    
    const dayKey = DAY_KEYS[dayIndex];
    const daySchedule = businessHours[dayKey];
    
    if (!daySchedule?.enabled) return false;
    
    const startHour = timeToHour(daySchedule.start);
    const endHour = timeToHour(daySchedule.end);
    
    return hour >= startHour && hour < endHour;
  };

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex flex-col h-full">
      {/* Header with navigation */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {format(weekStart, 'MMMM yyyy')}
        </h2>
        {timezone && (
          <span className="text-sm text-muted-foreground">
            {timezone.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 bg-card z-10 border-b border-border">
            <div className="p-2 border-r border-border" /> {/* Time column header */}
            {days.map((day, index) => {
              const isToday = isSameDay(day, today);
              const dayKey = DAY_KEYS[index];
              const isAvailableDay = businessHours?.[dayKey]?.enabled ?? true;
              
              return (
                <div
                  key={index}
                  className={cn(
                    "p-3 text-center border-r border-border last:border-r-0",
                    !isAvailableDay && "bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "text-xs uppercase tracking-wider mb-1",
                    isToday ? "text-primary font-semibold" : "text-muted-foreground"
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-lg font-semibold inline-flex items-center justify-center w-8 h-8 rounded-full",
                    isToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50">
                {/* Time label */}
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r border-border h-12 flex items-start justify-end">
                  {formatHour(hour)}
                </div>
                
                {/* Day cells */}
                {days.map((day, dayIndex) => {
                  const available = isHourAvailable(dayIndex, hour);
                  const isCurrentHour = isSameDay(day, today) && today.getHours() === hour;
                  
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "h-12 border-r border-border/50 last:border-r-0 transition-colors relative",
                        available 
                          ? "bg-card hover:bg-accent/30" 
                          : "bg-muted/40",
                        isCurrentHour && "ring-1 ring-primary/50"
                      )}
                    >
                      {!available && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-full h-[1px] bg-border/60" 
                            style={{
                              background: 'repeating-linear-gradient(90deg, transparent, transparent 4px, hsl(var(--border)) 4px, hsl(var(--border)) 8px)'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current time indicator */}
            {isSameDay(weekStart, today) || days.some(d => isSameDay(d, today)) ? (
              <div 
                className="absolute left-[60px] right-0 h-0.5 bg-primary z-20 pointer-events-none"
                style={{
                  top: `${(today.getHours() + today.getMinutes() / 60) * 48}px`
                }}
              >
                <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 p-3 border-t border-border bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-card border border-border" />
          <span className="text-muted-foreground">Available hours</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/60 border border-border" />
          <span className="text-muted-foreground">After hours (AI answers)</span>
        </div>
      </div>
    </div>
  );
}
