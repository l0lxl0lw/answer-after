import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CalendarView } from "@/components/calendar/CalendarView";

export default function Schedules() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <CalendarView defaultView="day" />
      </div>
    </DashboardLayout>
  );
}
