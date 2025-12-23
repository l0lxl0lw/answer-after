import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useRecentCalls, useOrganization } from "@/hooks/use-api";
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

// Mock chart data (weekly)
const weeklyChartData = [
  { name: "Mon", calls: 180, revenue: 4200 },
  { name: "Tue", calls: 320, revenue: 5800 },
  { name: "Wed", calls: 450, revenue: 7200 },
  { name: "Thu", calls: 520, revenue: 8100 },
  { name: "Fri", calls: 680, revenue: 9500 },
  { name: "Sat", calls: 920, revenue: 12800 },
  { name: "Sun", calls: 780, revenue: 11200 },
];

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentCalls, isLoading: callsLoading } = useRecentCalls(5);
  const { data: organization } = useOrganization();

  // Fetch Google Contacts for name mapping
  const { data: googleContacts } = useQuery({
    queryKey: ['google-contacts-dashboard', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase.functions.invoke('google-contacts', {
        body: { action: 'list', organizationId: organization.id }
      });
      if (error) throw error;
      return data?.contacts as RawGoogleContact[] || [];
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            AI ACTIVE
          </Badge>
        </motion.div>

        {/* Stats Grid - 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0 }}
          >
            <StatCard
              title="Total Calls"
              value={stats?.total_calls_week ?? 0}
              icon={Phone}
              iconBgColor="bg-sky-100 dark:bg-sky-900/30"
              iconColor="text-sky-600 dark:text-sky-400"
              trend={{ value: "12%", up: true }}
              loading={statsLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <StatCard
              title="Bookings Made"
              value={stats?.appointments_booked_today ?? 0}
              icon={Calendar}
              iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              trend={{ value: "8%", up: true }}
              loading={statsLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <StatCard
              title="Revenue"
              value={`$${((stats?.revenue_captured_estimate ?? 0)).toLocaleString()}`}
              icon={DollarSign}
              iconBgColor="bg-violet-100 dark:bg-violet-900/30"
              iconColor="text-violet-600 dark:text-violet-400"
              trend={{ value: "22%", up: true }}
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
                    <LineChart data={weeklyChartData}>
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
                        strokeDasharray="5 5"
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
