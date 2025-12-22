import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppointments, useTechnicians, useOrganization } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { AppointmentReminders } from "@/components/appointments/AppointmentReminders";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/20 text-primary",
  confirmed: "bg-info/20 text-info",
  in_progress: "bg-warning/20 text-warning",
  completed: "bg-success/20 text-success",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/20 text-destructive",
};

export default function Appointments() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { data, isLoading } = useAppointments(page, 10);
  const { data: technicians } = useTechnicians();
  const { data: organization } = useOrganization();
  
  const appointments = data?.appointments || [];
  const meta = data?.meta;

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = 
      apt.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      apt.customer_phone.includes(search) ||
      apt.issue_description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return "Unassigned";
    const tech = technicians?.find((t) => t.id === techId);
    return tech?.full_name || "Unknown";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">
              Appointments
            </h1>
            <p className="text-muted-foreground">
              View and manage scheduled service appointments
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, phone, or issue..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appointments Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Appointments ({meta?.total || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-medium mb-2">No appointments found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {appointments.length === 0
                      ? "No appointments have been scheduled yet."
                      : "No appointments match your search criteria."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map((apt) => (
                        <>
                          <TableRow 
                            key={apt.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                          >
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {apt.customer_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {apt.customer_phone}
                                  </p>
                                  {apt.customer_address && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {apt.customer_address}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {format(new Date(apt.scheduled_start), "MMM d, yyyy")}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(apt.scheduled_start), "h:mm a")} - {format(new Date(apt.scheduled_end), "h:mm a")}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="max-w-[200px] truncate">{apt.issue_description}</p>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                apt.technician_id ? "text-foreground" : "text-muted-foreground"
                              )}>
                                {getTechnicianName(apt.technician_id)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={statusColors[apt.status] || "bg-muted"}>
                                  {apt.status.replace("_", " ")}
                                </Badge>
                                {expandedId === apt.id ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          <AnimatePresence>
                            {expandedId === apt.id && organization && (
                              <TableRow key={`${apt.id}-details`}>
                                <TableCell colSpan={5} className="bg-muted/20 p-0">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium text-sm mb-2">Appointment Details</h4>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                          <p><strong>Issue:</strong> {apt.issue_description}</p>
                                          {apt.notes && <p><strong>Notes:</strong> {apt.notes}</p>}
                                        </div>
                                      </div>
                                      <AppointmentReminders
                                        appointmentId={apt.id}
                                        appointmentStart={apt.scheduled_start}
                                        organizationId={organization.id}
                                      />
                                    </div>
                                  </motion.div>
                                </TableCell>
                              </TableRow>
                            )}
                          </AnimatePresence>
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {meta && meta.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {meta.page} of {meta.total_pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                      disabled={page === meta.total_pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
