import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  Clock,
  Search,
  Filter,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useCalls } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { Call } from "@/types/database";

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get badge variant based on outcome
function getOutcomeBadge(outcome: string | null) {
  switch (outcome) {
    case "booked":
      return { variant: "default" as const, label: "Booked" };
    case "callback_requested":
      return { variant: "secondary" as const, label: "Callback" };
    case "information_provided":
      return { variant: "secondary" as const, label: "Info Provided" };
    case "escalated":
      return { variant: "destructive" as const, label: "Escalated" };
    case "no_action":
      return { variant: "outline" as const, label: "No Action" };
    case "voicemail":
      return { variant: "outline" as const, label: "Voicemail" };
    default:
      return { variant: "outline" as const, label: "Active" };
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-success";
    case "failed":
      return "text-destructive";
    case "in_progress":
      return "text-info";
    case "voicemail":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

// Call Row Component
function CallRow({ call }: { call: Call }) {
  const badge = getOutcomeBadge(call.outcome);

  return (
    <Link
      to={`/dashboard/calls/${call.id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
          <PhoneIncoming className="w-6 h-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {call.caller_name || "Unknown Caller"}
            </p>
            <span className="text-sm text-muted-foreground flex-shrink-0">
              {call.caller_phone}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {call.summary || "No summary available"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0 ml-4">
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium">
            {format(new Date(call.started_at), "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(call.started_at), "h:mm a")}
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDuration(call.duration_seconds)}
          </p>
          <p className={cn("text-xs capitalize", getStatusColor(call.status))}>
            {call.status.replace("_", " ")}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

export default function CallHistory() {
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const { data, isLoading } = useCalls({
    search: search || undefined,
    outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
    start_date: dateRange.from?.toISOString(),
    end_date: dateRange.to?.toISOString(),
  });

  const hasFilters = search || outcomeFilter !== "all" || dateRange.from || dateRange.to;

  const clearFilters = () => {
    setSearch("");
    setOutcomeFilter("all");
    setDateRange({ from: undefined, to: undefined });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
            Call History
          </h1>
          <p className="text-muted-foreground">
            View and manage all after-hours calls
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, or summary..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Outcome Filter */}
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="callback_requested">Callback Requested</SelectItem>
                    <SelectItem value="information_provided">Info Provided</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="no_action">No Action</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full lg:w-[240px] justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd")} -{" "}
                            {format(dateRange.to, "LLL dd")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) =>
                        setDateRange({ from: range?.from, to: range?.to })
                      }
                      numberOfMonths={2}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear Filters */}
                {hasFilters && (
                  <Button variant="ghost" size="icon" onClick={clearFilters}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32 inline-block" />
            ) : (
              <>
                Showing <strong>{data?.calls.length ?? 0}</strong> of{" "}
                <strong>{data?.meta.total ?? 0}</strong> calls
              </>
            )}
          </p>
          {hasFilters && (
            <Button variant="link" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          )}
        </div>

        {/* Call List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-3"
        >
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : data?.calls && data.calls.length > 0 ? (
            data.calls.map((call) => <CallRow key={call.id} call={call} />)
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium mb-2">No calls found</h3>
                <p className="text-sm text-muted-foreground">
                  {hasFilters
                    ? "Try adjusting your filters"
                    : "Calls will appear here when they come in"}
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Pagination placeholder */}
        {data && data.meta.total_pages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Page {data.meta.page} of {data.meta.total_pages}
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
