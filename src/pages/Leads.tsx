import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLeads, useUpdateContact, type ContactFilters } from "@/hooks/use-contacts";
import { InterestLevelBadge } from "@/components/leads/InterestLevelBadge";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { LeadNotesDialog } from "@/components/leads/LeadNotesDialog";
import { exportLeadsToCSV } from "@/lib/export-csv";
import type { InterestLevel, LeadStatus, Contact } from "@/types/database";
import {
  Search,
  Download,
  MoreHorizontal,
  Phone,
  MessageSquare,
  FileText,
  Flame,
  Thermometer,
  Snowflake,
  ExternalLink,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatPhoneDisplay } from "@/lib/phoneUtils";

export default function Leads() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Omit<ContactFilters, 'status'>>({});
  const [searchInput, setSearchInput] = useState("");
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; lead: Contact | null }>({
    open: false,
    lead: null,
  });

  const { data, isLoading } = useLeads(filters, page, 20);
  const updateLead = useUpdateContact();

  const leads = data?.contacts || [];
  const meta = data?.meta || { page: 1, per_page: 20, total: 0, total_pages: 0 };
  const stats = data?.stats || { total: 0, hot: 0, warm: 0, cold: 0 };

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
    setPage(1);
  };

  const handleFilterChange = (key: keyof ContactFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
    setPage(1);
  };

  const handleUpdateInterest = async (id: string, level: InterestLevel) => {
    try {
      await updateLead.mutateAsync({ id, interest_level: level });
      toast({ title: "Interest level updated" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (id: string, status: LeadStatus) => {
    try {
      await updateLead.mutateAsync({ id, lead_status: status });
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!notesDialog.lead) return;
    await updateLead.mutateAsync({ id: notesDialog.lead.id, lead_notes: notes });
    toast({ title: "Notes saved" });
  };

  const handleExport = () => {
    if (leads.length === 0) {
      toast({ title: "No leads to export", variant: "destructive" });
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    exportLeadsToCSV(leads as Contact[], `leads-${dateStr}.csv`);
    toast({ title: "Leads exported", description: `${leads.length} leads exported to CSV` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              Manage callers who haven't booked yet
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hot</p>
                  <p className="text-2xl font-bold text-red-600">{stats.hot}</p>
                </div>
                <Flame className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warm</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.warm}</p>
                </div>
                <Thermometer className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cold</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.cold}</p>
                </div>
                <Snowflake className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={filters.interest_level || "all"}
                  onValueChange={(v) => handleFilterChange("interest_level", v)}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Interest" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Interest</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.lead_status || "all"}
                  onValueChange={(v) => handleFilterChange("lead_status", v)}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.has_name === true ? "named" : filters.has_name === false ? "anonymous" : "all"}
                  onValueChange={(v) => {
                    if (v === "named") setFilters((prev) => ({ ...prev, has_name: true }));
                    else if (v === "anonymous") setFilters((prev) => ({ ...prev, has_name: false }));
                    else setFilters((prev) => ({ ...prev, has_name: undefined }));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Contact" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="named">Named</SelectItem>
                    <SelectItem value="anonymous">Anonymous</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch}>Search</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leads Table */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {meta.total} {meta.total === 1 ? "Lead" : "Leads"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No leads found</h3>
                  <p className="text-muted-foreground">
                    Leads will appear here when callers don't book an appointment
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Called</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <div className="font-medium">
                                {lead.name || "Unknown"}
                              </div>
                              {lead.notes && (
                                <p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                                  {lead.notes}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatPhoneDisplay(lead.phone)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <InterestLevelBadge level={lead.interest_level} />
                            </TableCell>
                            <TableCell>
                              <LeadStatusBadge status={lead.lead_status || "new"} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <a href={`tel:${lead.phone}`}>
                                      <Phone className="w-4 h-4 mr-2" />
                                      Call Back
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link to={`/dashboard/messages?phone=${encodeURIComponent(lead.phone)}`}>
                                      <MessageSquare className="w-4 h-4 mr-2" />
                                      Send SMS
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setNotesDialog({ open: true, lead: lead as Contact })}
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    {lead.lead_notes ? "Edit Notes" : "Add Notes"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <Flame className="w-4 h-4 mr-2" />
                                      Set Interest
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem onClick={() => handleUpdateInterest(lead.id, "hot")}>
                                        <Flame className="w-4 h-4 mr-2 text-red-500" />
                                        Hot
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateInterest(lead.id, "warm")}>
                                        <Thermometer className="w-4 h-4 mr-2 text-amber-500" />
                                        Warm
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateInterest(lead.id, "cold")}>
                                        <Snowflake className="w-4 h-4 mr-2 text-blue-500" />
                                        Cold
                                      </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      Set Status
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(lead.id, "new")}>
                                        New
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(lead.id, "contacted")}>
                                        Contacted
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(lead.id, "converted")}>
                                        Converted
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleUpdateStatus(lead.id, "lost")}>
                                        Lost
                                      </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <Link to={`/dashboard/calls/${lead.id}`}>
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Call Details
                                    </Link>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {meta.total_pages > 1 && (
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
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                          disabled={page === meta.total_pages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Notes Dialog */}
      <LeadNotesDialog
        open={notesDialog.open}
        onOpenChange={(open) => setNotesDialog({ open, lead: open ? notesDialog.lead : null })}
        initialNotes={notesDialog.lead?.lead_notes || ""}
        onSave={handleSaveNotes}
        callerName={notesDialog.lead?.name}
      />
    </DashboardLayout>
  );
}
