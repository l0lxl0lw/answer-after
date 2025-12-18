import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  ArrowUpRight,
  User,
  Users,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useRecentCalls, useCurrentOnCall, useAppointments } from "@/hooks/use-api";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { Call } from "@/types/database";

// Format duration from seconds to MM:SS
function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get badge variant based on outcome
function getOutcomeBadge(outcome: string | null, isEmergency: boolean) {
  if (isEmergency) {
    return { variant: "destructive" as const, label: "Emergency" };
  }
  switch (outcome) {
    case "dispatched":
      return { variant: "default" as const, label: "Dispatched" };
    case "booked":
      return { variant: "default" as const, label: "Booked" };
    case "message_taken":
      return { variant: "secondary" as const, label: "Message" };
    case "resolved":
      return { variant: "secondary" as const, label: "Resolved" };
    case "escalated":
      return { variant: "destructive" as const, label: "Escalated" };
    default:
      return { variant: "outline" as const, label: "Pending" };
  }
}

// Stat Card Component
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: { value: string; up: boolean };
  loading?: boolean;
}) {
  return (
    <Card className="bg-card hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                trend.up ? "text-success" : "text-destructive"
              }`}
            >
              <ArrowUpRight className={`w-4 h-4 ${!trend.up && "rotate-180"}`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className="space-y-1">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl lg:text-3xl font-display font-bold">{value}</p>
          )}
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// On-Call Status Card
function OnCallStatusCard() {
  const { data: onCall, isLoading } = useCurrentOnCall();

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          On-Call Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {/* Primary On-Call */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Primary
                </span>
                <Badge variant="default" className="bg-success text-success-foreground">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {onCall?.primary?.full_name || "No one assigned"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {onCall?.primary?.phone || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Backup On-Call */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Backup
                </span>
                <Badge variant="outline">Standby</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">
                    {onCall?.backup?.full_name || "No backup assigned"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {onCall?.backup?.phone || "—"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <Link to="/dashboard/schedules">
          <Button variant="outline" size="sm" className="w-full mt-2">
            <Calendar className="w-4 h-4 mr-2" />
            Manage Schedules
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Recent Call Item
function RecentCallItem({ call }: { call: Call }) {
  const badge = getOutcomeBadge(call.outcome, call.is_emergency);
  const timeAgo = formatDistanceToNow(new Date(call.started_at), { addSuffix: true });

  return (
    <Link
      to={`/dashboard/calls/${call.id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            call.is_emergency
              ? "bg-destructive/10"
              : "bg-primary/10"
          }`}
        >
          {call.is_emergency ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : (
            <PhoneIncoming className="w-5 h-5 text-primary" />
          )}
        </div>
        <div>
          <p className="font-medium group-hover:text-primary transition-colors">
            {call.caller_name || call.caller_phone}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {call.summary?.slice(0, 50) || "No summary available"}...
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm">{timeAgo}</p>
          <p className="text-xs text-muted-foreground">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatDuration(call.duration_seconds)}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
    </Link>
  );
}

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentCalls, isLoading: callsLoading } = useRecentCalls(5);
  const { data: appointments } = useAppointments(1, 3);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your after-hours calls.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[
            {
              title: "Total Calls Today",
              value: stats?.total_calls_today ?? 0,
              icon: Phone,
              description: `${stats?.total_calls_week ?? 0} this week`,
              trend: { value: "+12%", up: true },
            },
            {
              title: "Emergencies",
              value: stats?.emergency_calls_today ?? 0,
              icon: AlertTriangle,
              description: "Handled today",
              trend: undefined,
            },
            {
              title: "Appointments",
              value: stats?.appointments_booked_today ?? 0,
              icon: Calendar,
              description: "Booked today",
              trend: { value: "+8%", up: true },
            },
            {
              title: "Revenue Captured",
              value: `$${(stats?.revenue_captured_estimate ?? 0).toLocaleString()}`,
              icon: DollarSign,
              description: "Estimated from calls",
              trend: { value: "+18%", up: true },
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <StatCard {...stat} loading={statsLoading} />
            </motion.div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Calls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">Recent Calls</CardTitle>
                <Link
                  to="/dashboard/calls"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {callsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : recentCalls && recentCalls.length > 0 ? (
                  <div className="space-y-3">
                    {recentCalls.map((call) => (
                      <RecentCallItem key={call.id} call={call} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No calls yet</p>
                    <p className="text-sm">Calls will appear here when they come in</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column: On-Call + Upcoming */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="space-y-6"
          >
            {/* On-Call Status */}
            <OnCallStatusCard />

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="font-display text-lg">
                  Upcoming Appointments
                </CardTitle>
                <Link
                  to="/dashboard/appointments"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {appointments?.appointments && appointments.appointments.length > 0 ? (
                  <div className="space-y-3">
                    {appointments.appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 rounded-xl border border-border hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm">{apt.customer_name}</p>
                          {apt.is_emergency && (
                            <Badge variant="destructive" className="text-xs">
                              Emergency
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                          {apt.issue_description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(apt.scheduled_start).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(apt.scheduled_start).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming appointments</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Answer Rate Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Answer Rate (Last 30 Days)
                    </p>
                    <p className="text-3xl font-display font-bold">
                      {statsLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        `${stats?.answer_rate ?? 0}%`
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">
                      {stats?.technicians_dispatched_today ?? 0}
                    </strong>{" "}
                    technicians dispatched today
                  </p>
                  <p>
                    Average call duration:{" "}
                    <strong className="text-foreground">
                      {formatDuration(stats?.average_call_duration ?? 0)}
                    </strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
