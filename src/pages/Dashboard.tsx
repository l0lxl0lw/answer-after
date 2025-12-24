import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Phone,
  PhoneIncoming,
  Calendar,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  MessageSquare,
  MoreVertical,
  User,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useRecentCalls, useOrganization, type DashboardPeriod } from "@/hooks/use-api";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDistanceToNow } from "date-fns";
import type { Call } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Raw Google Contact structure from API
interface RawGoogleContact {
  resourceName: string;
  names?: Array<{ displayName?: string; givenName?: string }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string }>;
  biographies?: Array<{ value?: string }>;
}

// Normalize phone number for comparison - extract last 10 digits
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Handle various formats: +12067780089, (206) 778-0089, 2067780089
  return digits.slice(-10);
}

// Extract phone numbers from contact for matching
function getContactPhones(contact: RawGoogleContact): string[] {
  const phones: string[] = [];
  if (contact.phoneNumbers) {
    contact.phoneNumbers.forEach(pn => {
      // Use canonicalForm first (E.164 format like +12067780089), then fallback to value
      if (pn.canonicalForm) phones.push(normalizePhone(pn.canonicalForm));
      if (pn.value) phones.push(normalizePhone(pn.value));
    });
  }
  return [...new Set(phones)]; // Remove duplicates
}

// Get display name from contact
function getContactDisplayName(contact: RawGoogleContact): string {
  return contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || 'Unknown';
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

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
      return { variant: "outline" as const, label: "Pending" };
  }
}

// Stat Card Component matching the reference design
function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  trend,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBgColor: string;
  iconColor: string;
  trend?: { value: string; up: boolean };
  loading?: boolean;
}) {
  return (
    <Card className="bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl ${iconBgColor} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-4 mb-1">{title}</p>
        <div className="flex items-center gap-2">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-0.5 text-sm font-medium ${
                trend.up ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {trend.up ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {trend.value}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Recent Call Item (compact)
function RecentCallItem({ call, contactName }: { call: Call; contactName?: string }) {
  const badge = getOutcomeBadge(call.outcome);
  const timeAgo = formatDistanceToNow(new Date(call.started_at), { addSuffix: true });
  const displayName = contactName || call.caller_name || call.caller_phone;
  const isKnownContact = !!contactName;

  return (
    <Link
      to={`/dashboard/calls/${call.id}`}
      className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isKnownContact ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
          {isKnownContact ? (
            <User className="w-4 h-4 text-emerald-600" />
          ) : (
            <PhoneIncoming className="w-4 h-4 text-primary" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>
      <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
    </Link>
  );
}


const Dashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>('7d');
  const { data: stats, isLoading: statsLoading } = useDashboardStats(period);
  const { data: recentCalls, isLoading: callsLoading } = useRecentCalls(5);
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: calendarConnection, isLoading: gcLoading } = useGoogleCalendarConnection();

  const periodLabel = period === '7d' ? '7 days' : period === '30d' ? '30 days' : period === '3m' ? '3 months' : '6 months';

  // Fetch Google Contacts for name mapping (only if Google is connected)
  const { data: googleContacts } = useQuery({
    queryKey: ['google-contacts-dashboard', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      try {
        const { data, error } = await supabase.functions.invoke('google-contacts', {
          body: { action: 'list', organizationId: organization.id }
        });
        // If no Google connection, return empty array (not an error)
        if (error || data?.error) {
          console.log('Google contacts not available:', data?.error || error);
          return [];
        }
        return data?.contacts as RawGoogleContact[] || [];
      } catch (e) {
        // Catch any thrown errors (e.g., 400 responses)
        console.log('Google contacts fetch failed:', e);
        return [];
      }
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if Google isn't connected
  });

  // Build phone-to-name map with multiple phone formats per contact
  const phoneToContactName = useMemo(() => {
    const map = new Map<string, string>();
    if (googleContacts) {
      googleContacts.forEach((contact) => {
        const name = getContactDisplayName(contact);
        const phones = getContactPhones(contact);
        phones.forEach(phone => {
          map.set(phone, name);
        });
      });
    }
    return map;
  }, [googleContacts]);

  // Get contact name for a call
  const getContactName = (call: Call): string | undefined => {
    const normalizedPhone = normalizePhone(call.caller_phone);
    return phoneToContactName.get(normalizedPhone);
  };

  const organizationName = "Your Business";

  // Show loading while checking connection
  if (gcLoading || orgLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </DashboardLayout>
    );
  }

  // Not connected - show connect page
  if (!calendarConnection) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Connect Google Account</CardTitle>
            <CardDescription>
              To view your dashboard and manage contacts, you need to connect your Google Calendar first. This will allow AnswerAfter to sync contacts from your calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard/integrations")}>
              Connect Google Account
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold mb-1">System Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Live operational data for {organizationName}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AI ACTIVE
            </Badge>
            <ToggleGroup 
              type="single" 
              value={period} 
              onValueChange={(value) => value && setPeriod(value as DashboardPeriod)}
              className="bg-muted/50 rounded-lg p-1"
            >
              <ToggleGroupItem value="7d" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">7d</ToggleGroupItem>
              <ToggleGroupItem value="30d" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">30d</ToggleGroupItem>
              <ToggleGroupItem value="3m" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">3m</ToggleGroupItem>
              <ToggleGroupItem value="6m" className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">6m</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0 }}
          >
            <StatCard
              title={`Total Calls (${periodLabel})`}
              value={stats?.total_calls ?? 0}
              icon={Phone}
              iconBgColor="bg-sky-100 dark:bg-sky-900/30"
              iconColor="text-sky-600 dark:text-sky-400"
              trend={stats?.calls_trend !== undefined ? { 
                value: `${Math.abs(stats.calls_trend)}%`, 
                up: stats.calls_trend >= 0 
              } : undefined}
              loading={statsLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <StatCard
              title={`Bookings (${periodLabel})`}
              value={stats?.appointments_booked ?? 0}
              icon={Calendar}
              iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              trend={stats?.bookings_trend !== undefined ? { 
                value: `${Math.abs(stats.bookings_trend)}%`, 
                up: stats.bookings_trend >= 0 
              } : undefined}
              loading={statsLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <StatCard
              title={`Est. Revenue (${periodLabel})`}
              value={`$${(stats?.revenue_estimate ?? 0).toLocaleString()}`}
              icon={DollarSign}
              iconBgColor="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
              trend={stats?.revenue_trend !== undefined ? { 
                value: `${Math.abs(stats.revenue_trend)}%`, 
                up: stats.revenue_trend >= 0 
              } : undefined}
              loading={statsLoading}
            />
          </motion.div>
        </div>

        {/* Chart + Recent Calls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Call Volume & Revenue Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Call Volume & Revenue</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-sky-500" />
                      <span className="text-muted-foreground">Calls</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-violet-500" />
                      <span className="text-muted-foreground">Revenue ($)</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats?.chart_data || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Calls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Recent Calls</CardTitle>
                  <Link
                    to="/dashboard/calls"
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {callsLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : recentCalls && recentCalls.length > 0 ? (
                  <div>
                    {recentCalls.map((call) => (
                      <RecentCallItem key={call.id} call={call} contactName={getContactName(call)} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground italic">No calls recorded today</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Automated SMS Log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Automated SMS Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground italic">No recent messages</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
