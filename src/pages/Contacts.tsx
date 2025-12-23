import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleCalendarConnection } from "@/hooks/useGoogleCalendarConnection";
import { 
  Users, 
  Plus, 
  Phone, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Search,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GoogleContact {
  resourceName: string;
  names?: Array<{ givenName?: string; familyName?: string; displayName?: string }>;
  phoneNumbers?: Array<{ value: string; type?: string }>;
  biographies?: Array<{ value: string }>;
}

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: connection, isLoading: isConnectionLoading } = useGoogleCalendarConnection();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<GoogleContact | null>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "" });

  // Fetch contacts
  const { data: contactsData, isLoading: isContactsLoading, error: contactsError, refetch } = useQuery({
    queryKey: ["google-contacts", user?.organization_id],
    queryFn: async () => {
      if (!user?.organization_id) return { contacts: [], needsReconnect: false };
      
      const { data, error } = await supabase.functions.invoke("google-contacts", {
        body: { action: "list", organizationId: user.organization_id },
      });

      if (error) {
        // Check if it's a scope error - user needs to reconnect
        throw error;
      }
      return data as { contacts: GoogleContact[], needsReconnect?: boolean };
    },
    enabled: !!user?.organization_id && !!connection,
    retry: false,
  });

  // Create contact mutation
  const createMutation = useMutation({
    mutationFn: async (contact: { name: string; phone: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke("google-contacts", {
        body: { 
          action: "create", 
          organizationId: user?.organization_id,
          ...contact 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Contact created", description: "Contact has been added to Google Contacts" });
      queryClient.invalidateQueries({ queryKey: ["google-contacts"] });
      setIsCreateOpen(false);
      setNewContact({ name: "", phone: "", notes: "" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
      console.error("Create contact error:", error);
    },
  });

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { resourceName: string; name: string; phone: string; notes: string }) => {
      const { data: result, error } = await supabase.functions.invoke("google-contacts", {
        body: { 
          action: "update", 
          organizationId: user?.organization_id,
          ...data 
        },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: "Contact updated", description: "Contact has been updated" });
      queryClient.invalidateQueries({ queryKey: ["google-contacts"] });
      setIsEditOpen(false);
      setEditingContact(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update contact", variant: "destructive" });
      console.error("Update contact error:", error);
    },
  });

  // Delete contact mutation
  const deleteMutation = useMutation({
    mutationFn: async (resourceName: string) => {
      const { data, error } = await supabase.functions.invoke("google-contacts", {
        body: { 
          action: "delete", 
          organizationId: user?.organization_id,
          resourceName 
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Contact deleted", description: "Contact has been removed" });
      queryClient.invalidateQueries({ queryKey: ["google-contacts"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
      console.error("Delete contact error:", error);
    },
  });

  const contacts = contactsData?.contacts || [];
  const filteredContacts = contacts.filter((contact) => {
    const name = contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || "";
    const phone = contact.phoneNumbers?.[0]?.value || "";
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || phone.includes(query);
  });

  const openEditDialog = (contact: GoogleContact) => {
    setEditingContact(contact);
    const bio = contact.biographies?.[0]?.value || "";
    const notesMatch = bio.replace(/^Source: AnswerAfter\n?/, "");
    setEditForm({
      name: contact.names?.[0]?.givenName || contact.names?.[0]?.displayName || "",
      phone: contact.phoneNumbers?.[0]?.value || "",
      notes: notesMatch,
    });
    setIsEditOpen(true);
  };

  // Show loading state
  if (isConnectionLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Show message if no Google connection
  if (!connection) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Connect Google Account</CardTitle>
            <CardDescription>
              To manage contacts, you need to connect your Google account first. This will allow us to sync contacts from your calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard/schedules/onboarding")}>
              Connect Google Account
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Show message if contacts scope is missing (user connected before contacts was added)
  if (contactsError) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle>Reconnect Required</CardTitle>
            <CardDescription>
              Your Google account was connected before contacts sync was added. Please reconnect your Google account to grant the new contacts permission.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard/schedules/onboarding")}>
              Reconnect Google Account
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Contacts
            </h1>
            <p className="text-muted-foreground">
              Manage contacts from your calls, synced to Google Contacts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isContactsLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isContactsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Create a new contact that will be synced to your Google Contacts
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={newContact.notes}
                      onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                      placeholder="Any additional notes..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createMutation.mutate(newContact)}
                      disabled={!newContact.name || !newContact.phone || createMutation.isPending}
                    >
                      {createMutation.isPending ? "Creating..." : "Create Contact"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Contacts</CardTitle>
                <CardDescription>
                  {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""} tagged with AnswerAfter
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1">
                <ExternalLink className="w-3 h-3" />
                Synced to Google
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isContactsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">No contacts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Contacts will be automatically created when callers provide their name
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Contact
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => {
                    const name = contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || "Unknown";
                    const phone = contact.phoneNumbers?.[0]?.value || "No phone";
                    const bio = contact.biographies?.[0]?.value || "";
                    const notes = bio.replace(/^Source: AnswerAfter\n?/, "");

                    return (
                      <TableRow key={contact.resourceName}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            {phone}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(contact)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this contact?")) {
                                  deleteMutation.mutate(contact.resourceName);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>
                Update contact information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => editingContact && updateMutation.mutate({
                    resourceName: editingContact.resourceName,
                    ...editForm
                  })}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
