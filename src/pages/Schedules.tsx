import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Clock,
  Edit2,
  RefreshCw,
  ExternalLink,
  Phone,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchedules, useTechnicians, useCreateSchedule, useCreateTechnician } from "@/hooks/use-api";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { cn } from "@/lib/utils";
import type { OnCallSchedule, TechnicianWithSchedule } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const TIME_SLOTS = [
  { label: "5 PM - 9 PM", start: 17, end: 21 },
  { label: "9 PM - 1 AM", start: 21, end: 1 },
  { label: "1 AM - 5 AM", start: 1, end: 5 },
  { label: "5 AM - 8 AM", start: 5, end: 8 },
];

function getSchedulesForDay(
  schedules: OnCallSchedule[],
  day: Date,
  technicians: TechnicianWithSchedule[]
): { schedule: OnCallSchedule; technician: TechnicianWithSchedule | undefined }[] {
  return schedules
    .filter((s) => {
      const start = parseISO(s.start_datetime);
      const end = parseISO(s.end_datetime);
      return isWithinInterval(day, { start, end }) || isSameDay(start, day) || isSameDay(end, day);
    })
    .map((schedule) => ({
      schedule,
      technician: technicians.find((t) => t.id === schedule.technician_id),
    }));
}

function ScheduleCard({
  schedule,
  technician,
  onEdit,
  compact = false,
}: {
  schedule: OnCallSchedule;
  technician?: TechnicianWithSchedule;
  onEdit?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2 transition-colors",
        schedule.is_primary ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", schedule.is_primary ? "bg-primary/20" : "bg-muted")}>
            <User className="w-3 h-3" />
          </div>
          <div className="min-w-0">
            <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>{technician?.full_name || "Unassigned"}</p>
            {!compact && <p className="text-xs text-muted-foreground">{schedule.is_primary ? "Primary" : "Backup"}</p>}
          </div>
        </div>
        {!compact && onEdit && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
            <Edit2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      {!compact && schedule.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{schedule.notes}</p>}
    </div>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  technicians,
  selectedDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians: TechnicianWithSchedule[];
  selectedDate?: Date;
}) {
  const { toast } = useToast();
  const createSchedule = useCreateSchedule();
  const [technicianId, setTechnicianId] = useState("");
  const [startDate, setStartDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("17:00");
  const [endDate, setEndDate] = useState(selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState("08:00");
  const [isPrimary, setIsPrimary] = useState(true);
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!technicianId) {
      toast({ title: "Please select a technician", variant: "destructive" });
      return;
    }
    try {
      await createSchedule.mutateAsync({
        technician_id: technicianId,
        start_datetime: new Date(`${startDate}T${startTime}`).toISOString(),
        end_datetime: new Date(`${endDate}T${endTime}`).toISOString(),
        is_primary: isPrimary,
        notes: notes || undefined,
      });
      toast({ title: "Schedule created successfully" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create schedule", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create On-Call Schedule</DialogTitle>
          <DialogDescription>Assign a technician to be on-call during the specified time period.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Technician</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>{tech.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Primary On-Call</Label>
              <p className="text-xs text-muted-foreground">Primary technician is contacted first</p>
            </div>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
          <div className="grid gap-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createSchedule.isPending}>{createSchedule.isPending ? "Saving..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TechnicianDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createTechnician = useCreateTechnician();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specializations, setSpecializations] = useState("");

  const handleSubmit = async () => {
    if (!fullName || !phone) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    try {
      await createTechnician.mutateAsync({
        full_name: fullName,
        phone,
        email: email || undefined,
        specializations: specializations ? specializations.split(",").map((s) => s.trim()) : [],
      });
      toast({ title: "Technician added successfully" });
      setFullName("");
      setPhone("");
      setEmail("");
      setSpecializations("");
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to add technician", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Technician</DialogTitle>
          <DialogDescription>Add a new technician to your team.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Smith" />
          </div>
          <div className="grid gap-2">
            <Label>Phone *</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
          </div>
          <div className="grid gap-2">
            <Label>Specializations</Label>
            <Input value={specializations} onChange={(e) => setSpecializations(e.target.value)} placeholder="HVAC, Plumbing, Electrical" />
            <p className="text-xs text-muted-foreground">Comma-separated list</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createTechnician.isPending}>{createTechnician.isPending ? "Adding..." : "Add Technician"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Schedules() {
  const navigate = useNavigate();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [techDialogOpen, setTechDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const { toast } = useToast();

  const { data: calendarConnection, isLoading: connectionLoading } = useGoogleCalendarConnection();
  const { data: schedules, isLoading: schedulesLoading } = useSchedules();
  const { data: technicians, isLoading: techniciansLoading } = useTechnicians();

  // Redirect to onboarding if no calendar connection
  useEffect(() => {
    if (!connectionLoading && !calendarConnection) {
      navigate("/dashboard/schedules/onboarding");
    }
  }, [calendarConnection, connectionLoading, navigate]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const isLoading = schedulesLoading || techniciansLoading || connectionLoading;

  const handleAddSchedule = (date?: Date) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  // Show loading while checking connection
  if (connectionLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Skeleton className="h-8 w-48" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl lg:text-3xl font-bold mb-2">Schedules & Technicians</h1>
          <p className="text-muted-foreground">Manage technician on-call rotations and team members</p>
        </motion.div>

        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />Schedules
            </TabsTrigger>
            <TabsTrigger value="technicians" className="flex items-center gap-2">
              <User className="w-4 h-4" />Technicians ({technicians?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-6">
            <div className="flex items-center justify-end">
              <Button onClick={() => handleAddSchedule()}>
                <Plus className="w-4 h-4 mr-2" />Add Schedule
              </Button>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())}>Today</Button>
                  </div>
                  <h2 className="font-display text-lg font-semibold">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary/30 border border-primary/50" /><span className="text-sm text-muted-foreground">Primary</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-muted border border-border" /><span className="text-sm text-muted-foreground">Backup</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6"><Skeleton className="h-96 w-full" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="p-3 text-left text-sm font-medium text-muted-foreground w-24">Time</th>
                          {weekDays.map((day) => (
                            <th key={day.toISOString()} className={cn("p-3 text-center border-l border-border", isSameDay(day, new Date()) && "bg-primary/5")}>
                              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                              <div className={cn("text-lg font-semibold", isSameDay(day, new Date()) && "text-primary")}>{format(day, "d")}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TIME_SLOTS.map((slot) => (
                          <tr key={slot.label} className="border-b border-border last:border-b-0">
                            <td className="p-3 text-sm text-muted-foreground align-top">
                              <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{slot.label}</div>
                            </td>
                            {weekDays.map((day) => {
                              const daySchedules = getSchedulesForDay(schedules || [], day, technicians || []);
                              return (
                                <td key={day.toISOString()} className={cn("p-2 border-l border-border align-top", isSameDay(day, new Date()) && "bg-primary/5")}>
                                  <div className="space-y-2 min-h-[80px]">
                                    {daySchedules.map(({ schedule, technician }) => (
                                      <ScheduleCard key={schedule.id} schedule={schedule} technician={technician} compact />
                                    ))}
                                    {daySchedules.length === 0 && (
                                      <button onClick={() => handleAddSchedule(day)} className="w-full h-16 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors">
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technicians" className="space-y-6">
            <div className="flex items-center justify-end">
              <Button onClick={() => setTechDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Technician</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" />Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {techniciansLoading ? (
                  <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : technicians && technicians.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Specializations</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {technicians.map((tech) => (
                        <TableRow key={tech.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                              <span className="font-medium">{tech.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{tech.phone}</p>
                              {tech.email && <p className="text-sm flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{tech.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tech.specializations && tech.specializations.length > 0 ? tech.specializations.map((spec) => <Badge key={spec} variant="secondary" className="text-xs">{spec}</Badge>) : <span className="text-muted-foreground text-sm">None</span>}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={tech.is_active ? "default" : "secondary"}>{tech.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="font-medium mb-2">No technicians yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add technicians to start creating on-call schedules.</p>
                    <Button onClick={() => setTechDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add First Technician</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} technicians={technicians || []} selectedDate={selectedDate} />
      <TechnicianDialog open={techDialogOpen} onOpenChange={setTechDialogOpen} />
    </DashboardLayout>
  );
}
