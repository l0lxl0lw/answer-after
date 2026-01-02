import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Phone,
  Mail,
  Loader2,
  Save,
  GripVertical,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { EscalationContact, EscalationRole } from '@/types/database';

const roleLabels: Record<EscalationRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  technician: 'Technician',
  on_call: 'On-Call',
};

const roleColors: Record<EscalationRole, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  technician: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  on_call: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  role: EscalationRole;
  is_active: boolean;
}

const defaultFormData: ContactFormData = {
  name: '',
  phone: '',
  email: '',
  role: 'on_call',
  is_active: true,
};

export default function EscalationContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EscalationContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ContactFormData>(defaultFormData);
  const [editingContact, setEditingContact] = useState<EscalationContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<EscalationContact | null>(null);

  // Load contacts
  useEffect(() => {
    if (user?.institution_id) {
      loadContacts();
    }
  }, [user?.institution_id]);

  const loadContacts = async () => {
    if (!user?.institution_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('escalation_contacts')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('priority', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error('Error loading contacts:', error);
      toast({
        title: 'Error loading contacts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!user?.institution_id) return;

    if (!formData.name || !formData.phone) {
      toast({
        title: 'Missing required fields',
        description: 'Name and phone number are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Get next priority
      const nextPriority = contacts.length > 0
        ? Math.max(...contacts.map(c => c.priority)) + 1
        : 1;

      const { error } = await supabase
        .from('escalation_contacts')
        .insert({
          institution_id: user.institution_id,
          name: formData.name,
          phone: normalizePhone(formData.phone),
          email: formData.email || null,
          role: formData.role,
          priority: nextPriority,
          is_active: formData.is_active,
        });

      if (error) throw error;

      toast({
        title: 'Contact added',
        description: `${formData.name} has been added to your escalation contacts.`,
      });

      setFormData(defaultFormData);
      setAddDialogOpen(false);
      loadContacts();
    } catch (error: any) {
      console.error('Error adding contact:', error);
      toast({
        title: 'Error adding contact',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;

    if (!formData.name || !formData.phone) {
      toast({
        title: 'Missing required fields',
        description: 'Name and phone number are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('escalation_contacts')
        .update({
          name: formData.name,
          phone: normalizePhone(formData.phone),
          email: formData.email || null,
          role: formData.role,
          is_active: formData.is_active,
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast({
        title: 'Contact updated',
        description: `${formData.name} has been updated.`,
      });

      setFormData(defaultFormData);
      setEditingContact(null);
      setEditDialogOpen(false);
      loadContacts();
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast({
        title: 'Error updating contact',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;

    try {
      const { error } = await supabase
        .from('escalation_contacts')
        .delete()
        .eq('id', deletingContact.id);

      if (error) throw error;

      toast({
        title: 'Contact deleted',
        description: `${deletingContact.name} has been removed.`,
      });

      setDeletingContact(null);
      setDeleteDialogOpen(false);
      loadContacts();
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      toast({
        title: 'Error deleting contact',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (contact: EscalationContact) => {
    try {
      const { error } = await supabase
        .from('escalation_contacts')
        .update({ is_active: !contact.is_active })
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: contact.is_active ? 'Contact deactivated' : 'Contact activated',
        description: `${contact.name} is now ${contact.is_active ? 'inactive' : 'active'}.`,
      });

      loadContacts();
    } catch (error: any) {
      console.error('Error toggling contact:', error);
      toast({
        title: 'Error updating contact',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMovePriority = async (contact: EscalationContact, direction: 'up' | 'down') => {
    const currentIndex = contacts.findIndex(c => c.id === contact.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= contacts.length) return;

    const otherContact = contacts[newIndex];

    try {
      // Swap priorities
      await supabase
        .from('escalation_contacts')
        .update({ priority: otherContact.priority })
        .eq('id', contact.id);

      await supabase
        .from('escalation_contacts')
        .update({ priority: contact.priority })
        .eq('id', otherContact.id);

      loadContacts();
    } catch (error: any) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error updating priority',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (contact: EscalationContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      role: contact.role,
      is_active: contact.is_active,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (contact: EscalationContact) => {
    setDeletingContact(contact);
    setDeleteDialogOpen(true);
  };

  const activeContacts = contacts.filter(c => c.is_active);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Escalation Contacts</h1>
            <p className="text-muted-foreground mt-1">
              Manage on-call contacts for emergency call transfers
            </p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Escalation Contact</DialogTitle>
                <DialogDescription>
                  Add a new contact for emergency call escalations. They'll receive calls when emergencies are detected.
                </DialogDescription>
              </DialogHeader>
              <ContactForm
                formData={formData}
                setFormData={setFormData}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddContact} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Contact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Info Card */}
        {activeContacts.length === 0 && !isLoading && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">No active escalation contacts</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Emergency calls won't be transferred until you add at least one active escalation contact.
                  Add a contact to enable emergency call routing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contacts List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              On-Call Rotation
            </CardTitle>
            <CardDescription>
              Contacts are called in order of priority. Drag to reorder or use arrows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No escalation contacts yet</p>
                <p className="text-sm mt-1">
                  Add contacts to receive emergency call transfers
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      contact.is_active
                        ? 'bg-card'
                        : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    {/* Priority Indicator */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleMovePriority(contact, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground rotate-90" />
                      </button>
                      <span className="text-lg font-bold text-primary w-6 text-center">
                        {contact.priority}
                      </span>
                      <button
                        onClick={() => handleMovePriority(contact, 'down')}
                        disabled={index === contacts.length - 1}
                        className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground rotate-90" />
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{contact.name}</span>
                        <Badge className={roleColors[contact.role]} variant="secondary">
                          {roleLabels[contact.role]}
                        </Badge>
                        {!contact.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                        {contact.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={contact.is_active}
                        onCheckedChange={() => handleToggleActive(contact)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(contact)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(contact)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>
                Update the contact's information.
              </DialogDescription>
            </DialogHeader>
            <ContactForm
              formData={formData}
              setFormData={setFormData}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditContact} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {deletingContact?.name}?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteContact}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

// Contact Form Component
function ContactForm({
  formData,
  setFormData,
}: {
  formData: ContactFormData;
  setFormData: (data: ContactFormData) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Smith"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number *</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+15551234567"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: EscalationRole) =>
            setFormData({ ...formData, role: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
            <SelectItem value="on_call">On-Call</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="space-y-0.5">
          <Label>Active</Label>
          <p className="text-sm text-muted-foreground">
            Only active contacts receive emergency calls
          </p>
        </div>
        <Switch
          checked={formData.is_active}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, is_active: checked })
          }
        />
      </div>
    </div>
  );
}

// Helper function to normalize phone numbers
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}
