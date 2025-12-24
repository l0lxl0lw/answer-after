import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WeekSchedule } from '@/components/settings/BusinessHoursSchedule';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGoogleConnectionGuard } from '@/hooks/useGoogleConnectionGuard';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  colorId?: string;
}

interface WeeklyCalendarViewProps {
  businessHours: WeekSchedule | null;
  timezone?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_KEYS: (keyof WeekSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Color mapping for Google Calendar events
const EVENT_COLORS: Record<string, string> = {
  '1': 'bg-blue-500',
  '2': 'bg-green-500',
  '3': 'bg-purple-500',
  '4': 'bg-red-500',
  '5': 'bg-yellow-500',
  '6': 'bg-orange-500',
  '7': 'bg-cyan-500',
  '8': 'bg-gray-500',
  '9': 'bg-blue-700',
  '10': 'bg-green-700',
  '11': 'bg-red-600',
  default: 'bg-primary',
};

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

function getEventPosition(event: CalendarEvent, dayStart: Date): { top: number; height: number } | null {
  const eventStart = parseISO(event.start);
  const eventEnd = parseISO(event.end);
  
  // Check if event is on this day
  if (!isSameDay(eventStart, dayStart)) return null;
  
  const startHour = eventStart.getHours() + eventStart.getMinutes() / 60;
  const endHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
  
  // Each hour is 48px tall
  const top = startHour * 48;
  const height = Math.max((endHour - startHour) * 48, 20); // Minimum 20px height
  
  return { top, height };
}

export function WeeklyCalendarView({ businessHours, timezone }: WeeklyCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleGoogleError } = useGoogleConnectionGuard();
  
  // Memoize weekStart to prevent unnecessary re-renders
  const weekStart = useMemo(() => 
    startOfWeek(currentDate, { weekStartsOn: 0 }),
    [currentDate.getTime()]
  );
  
  // Create a stable string key for the week to use in dependencies
  const weekKey = weekStart.toISOString();
  
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekKey]);

  const today = new Date();

  // Fetch calendar events
  useEffect(() => {
    let cancelled = false;
    
    async function fetchEvents() {
      if (!user?.organization_id) return;
      
      setIsLoading(true);
      setFetchAttempted(true);
      
      try {
        const weekEnd = addDays(weekStart, 7);
        
        const { data, error } = await supabase.functions.invoke('google-calendar-events', {
          body: {
            action: 'list',
            organizationId: user.organization_id,
            timeMin: weekStart.toISOString(),
            timeMax: weekEnd.toISOString(),
          },
        });

        if (cancelled) return;

        // Check for Google connection error and redirect
        if (handleGoogleError(error, data)) {
          return;
        }

        if (error) {
          console.error('Error fetching events:', error);
          return;
        }

        setEvents(data?.events || []);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch calendar events:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();
    
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, weekKey, handleGoogleError]);

  const isHourAvailable = (dayIndex: number, hour: number): boolean => {
    if (!businessHours) return true;
    
    const dayKey = DAY_KEYS[dayIndex];
    const daySchedule = businessHours[dayKey];
    
    if (!daySchedule?.enabled) return false;
    
    const startHour = timeToHour(daySchedule.start);
    const endHour = timeToHour(daySchedule.end);
    
    return hour >= startHour && hour < endHour;
  };

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter(event => {
      const eventStart = parseISO(event.start);
      return isSameDay(eventStart, day);
    });
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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {format(weekStart, 'MMMM yyyy')}
          </h2>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
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
              const dayEvents = getEventsForDay(day);
              
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
                  {dayEvents.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                    </div>
                  )}
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
                          : "bg-muted",
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

            {/* Render events as overlays */}
            {days.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day);
              
              return dayEvents.map((event) => {
                const position = getEventPosition(event, day);
                if (!position) return null;
                
                const colorClass = EVENT_COLORS[event.colorId || 'default'] || EVENT_COLORS.default;
                // Calculate left position: 60px for time column + dayIndex * (100% / 7)
                const leftPercent = ((dayIndex) / 7) * 100;
                const widthPercent = 100 / 7;
                
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "absolute rounded-md px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-sm",
                      colorClass
                    )}
                    style={{
                      top: `${position.top}px`,
                      height: `${position.height}px`,
                      left: `calc(60px + ${leftPercent}%)`,
                      width: `calc(${widthPercent}% - 4px)`,
                      zIndex: 15,
                    }}
                    title={`${event.summary}\n${format(parseISO(event.start), 'h:mm a')} - ${format(parseISO(event.end), 'h:mm a')}`}
                  >
                    <div className="font-medium truncate">{event.summary}</div>
                    <div className="opacity-80 truncate">
                      {format(parseISO(event.start), 'h:mm a')}
                    </div>
                  </div>
                );
              });
            })}

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
          <span className="text-muted-foreground">Unavailable</span>
        </div>
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary" />
            <span className="text-muted-foreground">Calendar events</span>
          </div>
        )}
      </div>
    </div>
  );
}
