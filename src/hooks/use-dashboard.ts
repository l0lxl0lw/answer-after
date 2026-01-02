// Dashboard hooks
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type DashboardPeriod = '7d' | '30d' | '3m' | '6m';

export interface DashboardStats {
  total_calls: number;
  appointments_booked: number;
  revenue_estimate: number;
  calls_trend: number;
  bookings_trend: number;
  revenue_trend: number;
  chart_data: Array<{
    name: string;
    calls: number;
    revenue: number;
  }>;
}

function getPeriodDays(period: DashboardPeriod): number {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '3m': return 90;
    case '6m': return 180;
    default: return 7;
  }
}

export function useDashboardStats(period: DashboardPeriod = '7d') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard', 'stats', user?.institution_id, period],
    queryFn: async () => {
      if (!user?.institution_id) return null;

      const periodDays = getPeriodDays(period);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Calculate date ranges for current period
      const periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() - (periodDays - 1));
      periodStart.setHours(0, 0, 0, 0);

      // Calculate date ranges for previous period (for trend comparison)
      const prevPeriodEnd = new Date(periodStart);
      prevPeriodEnd.setMilliseconds(-1);

      const prevPeriodStart = new Date(prevPeriodEnd);
      prevPeriodStart.setDate(prevPeriodStart.getDate() - (periodDays - 1));
      prevPeriodStart.setHours(0, 0, 0, 0);

      // Get calls for current period
      const { data: periodCalls, error: periodError } = await supabase
        .from('calls')
        .select('id, outcome, started_at, duration_seconds')
        .eq('institution_id', user.institution_id)
        .gte('started_at', periodStart.toISOString())
        .lte('started_at', today.toISOString());

      if (periodError) throw periodError;

      // Get calls for previous period
      const { data: prevPeriodCalls, error: prevPeriodError } = await supabase
        .from('calls')
        .select('id, outcome')
        .eq('institution_id', user.institution_id)
        .gte('started_at', prevPeriodStart.toISOString())
        .lte('started_at', prevPeriodEnd.toISOString());

      if (prevPeriodError) throw prevPeriodError;

      // Get appointments for current period (with service price for gross production)
      const { data: periodAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, created_at, service_price_cents')
        .eq('institution_id', user.institution_id)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', today.toISOString());

      if (appointmentsError) throw appointmentsError;

      // Get appointments for previous period
      const { data: prevPeriodAppointments } = await supabase
        .from('appointments')
        .select('id, service_price_cents')
        .eq('institution_id', user.institution_id)
        .gte('created_at', prevPeriodStart.toISOString())
        .lte('created_at', prevPeriodEnd.toISOString());

      // Calculate current period stats
      const totalCalls = periodCalls?.length || 0;
      const totalBookings = periodAppointments?.length || 0;
      // Sum actual service prices for gross production (in dollars)
      const revenueEstimate = (periodAppointments || [])
        .reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100;

      // Calculate previous period stats
      const prevTotalCalls = prevPeriodCalls?.length || 0;
      const prevTotalBookings = prevPeriodAppointments?.length || 0;
      const prevRevenue = (prevPeriodAppointments || [])
        .reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100;

      // Calculate trends (percentage change)
      const callsTrend = prevTotalCalls > 0
        ? Math.round(((totalCalls - prevTotalCalls) / prevTotalCalls) * 100)
        : totalCalls > 0 ? 100 : 0;

      const bookingsTrend = prevTotalBookings > 0
        ? Math.round(((totalBookings - prevTotalBookings) / prevTotalBookings) * 100)
        : totalBookings > 0 ? 100 : 0;

      const revenueTrend = prevRevenue > 0
        ? Math.round(((revenueEstimate - prevRevenue) / prevRevenue) * 100)
        : revenueEstimate > 0 ? 100 : 0;

      // Build chart data - aggregate by day for 7d/30d, by week for 3m/6m
      const chartData: Array<{ name: string; calls: number; revenue: number }> = [];

      if (period === '7d') {
        // Daily data for 7 days
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = periodDays - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);

          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= date && callDate < nextDate;
          }).length || 0;

          const dayAppointments = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= date && aptDate < nextDate;
          }) || [];
          const dayRevenue = dayAppointments.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100;

          chartData.push({
            name: dayNames[date.getDay()],
            calls: dayCalls,
            revenue: Math.round(dayRevenue),
          });
        }
      } else if (period === '30d') {
        // Show every 5 days for 30d
        for (let i = 5; i >= 0; i--) {
          const endDate = new Date(today);
          endDate.setDate(endDate.getDate() - (i * 5));
          endDate.setHours(23, 59, 59, 999);

          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 4);
          startDate.setHours(0, 0, 0, 0);

          const rangeCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= startDate && callDate <= endDate;
          }).length || 0;

          const rangeAppointments = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= startDate && aptDate <= endDate;
          }) || [];
          const rangeRevenue = rangeAppointments.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100;

          chartData.push({
            name: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
            calls: rangeCalls,
            revenue: Math.round(rangeRevenue),
          });
        }
      } else {
        // Weekly aggregation for 3m/6m
        const weeksToShow = period === '3m' ? 12 : 24;
        for (let i = weeksToShow - 1; i >= 0; i--) {
          const endDate = new Date(today);
          endDate.setDate(endDate.getDate() - (i * 7));
          endDate.setHours(23, 59, 59, 999);

          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          const weekCalls = periodCalls?.filter(call => {
            const callDate = new Date(call.started_at);
            return callDate >= startDate && callDate <= endDate;
          }).length || 0;

          const weekAppointments = periodAppointments?.filter(apt => {
            const aptDate = new Date(apt.created_at);
            return aptDate >= startDate && aptDate <= endDate;
          }) || [];
          const weekRevenue = weekAppointments.reduce((sum, apt) => sum + (apt.service_price_cents || 0), 0) / 100;

          chartData.push({
            name: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
            calls: weekCalls,
            revenue: Math.round(weekRevenue),
          });
        }
      }

      return {
        total_calls: totalCalls,
        appointments_booked: totalBookings,
        revenue_estimate: Math.round(revenueEstimate),
        calls_trend: callsTrend,
        bookings_trend: bookingsTrend,
        revenue_trend: revenueTrend,
        chart_data: chartData,
      } as DashboardStats;
    },
    enabled: !!user?.institution_id,
    refetchInterval: 30000,
  });
}
