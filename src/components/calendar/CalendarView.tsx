import { useState, useMemo } from "react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  Plus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DayView } from "./DayView";
import { NewEventDialog } from "./NewEventDialog";
import { useDayEvents, useWeekEvents, type CalendarEvent } from "@/hooks/use-calendar";
import { useActiveProviders, type Provider } from "@/hooks/use-providers";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type ViewType = "day" | "week" | "agenda";

interface CalendarViewProps {
  defaultView?: ViewType;
}

export function CalendarView({ defaultView = "day" }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>(defaultView);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEventDefaults, setNewEventDefaults] = useState<{
    date?: Date;
    time?: string;
    providerId?: string;
  }>({});

  const { data: providers, isLoading: providersLoading } = useActiveProviders();

  // Fetch events based on view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const { data: dayEvents, isLoading: dayEventsLoading, refetch: refetchDay } = useDayEvents(
    currentDate,
    selectedProviders.length > 0 ? selectedProviders : undefined
  );
  const { data: weekEvents, isLoading: weekEventsLoading, refetch: refetchWeek } = useWeekEvents(
    weekStart,
    selectedProviders.length > 0 ? selectedProviders : undefined
  );

  const isLoading = providersLoading || (view === "day" ? dayEventsLoading : weekEventsLoading);
  const events = view === "day" ? dayEvents : weekEvents;

  // Filter providers for display
  const displayProviders = useMemo(() => {
    if (!providers) return [];
    if (selectedProviders.length === 0) return providers;
    return providers.filter((p) => selectedProviders.includes(p.id));
  }, [providers, selectedProviders]);

  const toggleProvider = (providerId: string) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId]
    );
  };

  const navigateDate = (direction: "prev" | "next") => {
    if (view === "day") {
      setCurrentDate((prev) =>
        direction === "next" ? addDays(prev, 1) : subDays(prev, 1)
      );
    } else {
      setCurrentDate((prev) =>
        direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1)
      );
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (time: string, providerId: string) => {
    setNewEventDefaults({
      date: currentDate,
      time,
      providerId,
    });
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setNewEventDefaults({});
    setEventDialogOpen(true);
  };

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setNewEventDefaults({ date: currentDate });
    setEventDialogOpen(true);
  };

  const handleRefresh = () => {
    if (view === "day") {
      refetchDay();
    } else {
      refetchWeek();
    }
  };

  const handleDialogClose = () => {
    setEventDialogOpen(false);
    setSelectedEvent(null);
    setNewEventDefaults({});
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Current date display */}
          <h2 className="text-lg font-semibold">
            {view === "day"
              ? format(currentDate, "EEEE, MMMM d, yyyy")
              : `Week of ${format(weekStart, "MMMM d, yyyy")}`}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                Providers
                {selectedProviders.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedProviders.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by Provider</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {providers?.map((provider) => (
                <DropdownMenuCheckboxItem
                  key={provider.id}
                  checked={
                    selectedProviders.length === 0 ||
                    selectedProviders.includes(provider.id)
                  }
                  onCheckedChange={() => toggleProvider(provider.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: provider.color }}
                    />
                    {provider.name}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
              {selectedProviders.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedProviders([])}
                  >
                    Show All
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View switcher */}
          <div className="flex rounded-lg border">
            <Button
              variant={view === "day" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setView("day")}
            >
              Day
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setView("week")}
            >
              Week
            </Button>
            <Button
              variant={view === "agenda" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setView("agenda")}
            >
              Agenda
            </Button>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>

          {/* New Event */}
          <Button onClick={handleNewEvent} className="gap-2">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <Card className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[500px] w-full" />
          </div>
        ) : providers && providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Providers Found</h3>
            <p className="text-muted-foreground mb-4">
              Add team members to start scheduling appointments
            </p>
            <Button asChild variant="outline">
              <a href="/dashboard/providers">Add Providers</a>
            </Button>
          </div>
        ) : view === "day" ? (
          <DayView
            date={currentDate}
            events={events || []}
            providers={displayProviders}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        ) : view === "week" ? (
          <WeekViewPlaceholder />
        ) : (
          <AgendaViewPlaceholder events={events || []} />
        )}
      </Card>

      {/* Event Dialog */}
      <NewEventDialog
        open={eventDialogOpen}
        onClose={handleDialogClose}
        event={selectedEvent}
        defaultDate={newEventDefaults.date}
        defaultTime={newEventDefaults.time}
        defaultProviderId={newEventDefaults.providerId}
      />
    </div>
  );
}

function WeekViewPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full p-8 text-center">
      <div>
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Week View Coming Soon</h3>
        <p className="text-muted-foreground">
          Use Day view for now to manage appointments
        </p>
      </div>
    </div>
  );
}

function AgendaViewPlaceholder({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Upcoming Events</h3>
          <p className="text-muted-foreground">
            Click "New" to create an appointment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2 overflow-auto max-h-[600px]">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
        >
          <div
            className="w-1 h-12 rounded-full"
            style={{ backgroundColor: event.provider?.color || "#3b82f6" }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{event.title}</div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(event.start_time), "h:mm a")} -{" "}
              {format(new Date(event.end_time), "h:mm a")}
            </div>
            {event.customer_name && (
              <div className="text-sm text-muted-foreground truncate">
                {event.customer_name}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {event.provider?.name}
          </div>
        </div>
      ))}
    </div>
  );
}
