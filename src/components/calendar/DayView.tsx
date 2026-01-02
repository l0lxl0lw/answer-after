import { useMemo, useRef, useEffect } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type CalendarEvent,
  getEventColor,
  formatTimeDisplay,
} from "@/hooks/use-calendar";
import { type Provider } from "@/hooks/use-providers";

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  providers: Provider[];
  onSlotClick?: (time: string, providerId: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  startHour?: number;
  endHour?: number;
  slotInterval?: number; // in minutes
}

// Generate time labels for the left axis
function generateTimeLabels(startHour: number, endHour: number): string[] {
  const labels: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    labels.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return labels;
}

// Calculate event position and height
function getEventStyle(
  event: CalendarEvent,
  startHour: number,
  slotHeight: number
) {
  const eventStart = new Date(event.start_time);
  const eventEnd = new Date(event.end_time);

  const startMinutes =
    eventStart.getHours() * 60 + eventStart.getMinutes() - startHour * 60;
  const durationMinutes =
    (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);

  const top = (startMinutes / 60) * slotHeight;
  const height = (durationMinutes / 60) * slotHeight;

  return { top, height: Math.max(height, 20) }; // Minimum height of 20px
}

export function DayView({
  date,
  events,
  providers,
  onSlotClick,
  onEventClick,
  startHour = 7,
  endHour = 20,
  slotInterval = 30,
}: DayViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timeLabels = useMemo(
    () => generateTimeLabels(startHour, endHour),
    [startHour, endHour]
  );

  const slotHeight = 60; // Height per hour in pixels
  const totalHeight = (endHour - startHour + 1) * slotHeight;

  // Group events by provider
  const eventsByProvider = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    providers.forEach((p) => grouped.set(p.id, []));
    grouped.set("unassigned", []);

    events.forEach((event) => {
      const providerId = event.provider_id || "unassigned";
      const existing = grouped.get(providerId) || [];
      existing.push(event);
      grouped.set(providerId, existing);
    });

    return grouped;
  }, [events, providers]);

  // Scroll to current time on mount
  useEffect(() => {
    if (isToday(date) && containerRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const scrollPosition =
        ((currentMinutes - startHour * 60) / 60) * slotHeight - 100;
      containerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [date, startHour, slotHeight]);

  // Generate slot times for click handling
  const handleSlotClick = (e: React.MouseEvent, providerId: string) => {
    if (!onSlotClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = startHour * 60 + (y / slotHeight) * 60;

    // Round to nearest 5 minutes
    const roundedMinutes = Math.round(totalMinutes / 5) * 5;
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    const time = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    onSlotClick(time, providerId);
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header with provider names */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-10">
        <div className="w-16 flex-shrink-0 p-2 border-r text-xs text-muted-foreground">
          {format(date, "EEE")}
          <div className="text-lg font-semibold text-foreground">
            {format(date, "d")}
          </div>
        </div>
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="flex-1 min-w-[120px] p-2 border-r last:border-r-0 text-center"
          >
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: provider.color }}
              />
              <span className="text-sm font-medium truncate">
                {provider.name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {provider.role}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time labels column */}
          <div className="w-16 flex-shrink-0 border-r relative">
            {timeLabels.map((time, index) => (
              <div
                key={time}
                className="absolute w-full text-right pr-2 text-xs text-muted-foreground"
                style={{ top: index * slotHeight - 8 }}
              >
                {formatTimeDisplay(time)}
              </div>
            ))}
          </div>

          {/* Provider columns */}
          {providers.map((provider) => (
            <ProviderColumn
              key={provider.id}
              provider={provider}
              events={eventsByProvider.get(provider.id) || []}
              startHour={startHour}
              endHour={endHour}
              slotHeight={slotHeight}
              slotInterval={slotInterval}
              onSlotClick={(e) => handleSlotClick(e, provider.id)}
              onEventClick={onEventClick}
              isToday={isToday(date)}
            />
          ))}
        </div>
      </div>

      {/* Current time indicator */}
      {isToday(date) && <CurrentTimeIndicator startHour={startHour} slotHeight={slotHeight} />}
    </div>
  );
}

interface ProviderColumnProps {
  provider: Provider;
  events: CalendarEvent[];
  startHour: number;
  endHour: number;
  slotHeight: number;
  slotInterval: number;
  onSlotClick: (e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  isToday: boolean;
}

function ProviderColumn({
  provider,
  events,
  startHour,
  endHour,
  slotHeight,
  slotInterval,
  onSlotClick,
  onEventClick,
  isToday,
}: ProviderColumnProps) {
  const totalSlots = ((endHour - startHour + 1) * 60) / slotInterval;

  return (
    <div
      className="flex-1 min-w-[120px] border-r last:border-r-0 relative cursor-pointer hover:bg-muted/20"
      onClick={onSlotClick}
    >
      {/* Hour grid lines */}
      {Array.from({ length: endHour - startHour + 1 }).map((_, index) => (
        <div
          key={index}
          className="absolute w-full border-t border-border/50"
          style={{ top: index * slotHeight }}
        />
      ))}

      {/* Half-hour grid lines */}
      {Array.from({ length: endHour - startHour + 1 }).map((_, index) => (
        <div
          key={`half-${index}`}
          className="absolute w-full border-t border-border/20"
          style={{ top: index * slotHeight + slotHeight / 2 }}
        />
      ))}

      {/* Events */}
      {events
        .filter((e) => e.status !== "cancelled")
        .map((event) => {
          const style = getEventStyle(event, startHour, slotHeight);
          const color = getEventColor(event);

          return (
            <div
              key={event.id}
              className={cn(
                "absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer transition-opacity hover:opacity-90",
                event.status === "tentative" && "opacity-70 border-dashed border-2"
              )}
              style={{
                top: style.top,
                height: style.height,
                backgroundColor: color,
                borderColor: color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick?.(event);
              }}
            >
              <div className="text-xs font-medium text-white truncate">
                {event.title}
              </div>
              {style.height > 30 && (
                <div className="text-xs text-white/80 truncate">
                  {formatTimeDisplay(
                    format(new Date(event.start_time), "HH:mm")
                  )}
                </div>
              )}
              {style.height > 45 && event.customer_name && (
                <div className="text-xs text-white/70 truncate">
                  {event.customer_name}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function CurrentTimeIndicator({
  startHour,
  slotHeight,
}: {
  startHour: number;
  slotHeight: number;
}) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const top = ((currentMinutes - startHour * 60) / 60) * slotHeight;

  if (top < 0) return null;

  return (
    <div
      className="absolute left-16 right-0 z-20 pointer-events-none"
      style={{ top: top + 48 }} // 48px for header
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}

