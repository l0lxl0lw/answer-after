import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  useCampaign,
  useUpdateCampaignStatus,
  useDeleteCampaign,
  type CampaignStatus,
} from '@/hooks/use-campaigns';
import {
  useCampaignContacts,
  useAddCampaignContacts,
  useRemoveCampaignContact,
} from '@/hooks/use-campaign-contacts';
import { useCustomers } from '@/hooks/use-contacts';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  Users,
  Phone,
  PhoneCall,
  Target,
  Plus,
  Loader2,
  Clock,
  Calendar,
  Settings,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { formatPhoneDisplay } from '@/lib/phoneUtils';

const statusConfig: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'outline' },
  completed: { label: 'Completed', variant: 'secondary' },
};

const contactStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground' },
  calling: { label: 'Calling', color: 'text-warning' },
  connected: { label: 'Connected', color: 'text-success' },
  completed: { label: 'Completed', color: 'text-success' },
  failed: { label: 'Failed', color: 'text-destructive' },
  skipped: { label: 'Skipped', color: 'text-muted-foreground' },
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: campaign, isLoading: isLoadingCampaign } = useCampaign(id);
  const { data: campaignContacts, isLoading: isLoadingContacts } = useCampaignContacts(id);
  const { data: customersData } = useCustomers({}, 1, 100);

  const updateStatus = useUpdateCampaignStatus();
  const deleteCampaign = useDeleteCampaign();
  const addContacts = useAddCampaignContacts();
  const removeContact = useRemoveCampaignContact();

  const [isAddContactsOpen, setIsAddContactsOpen] = useState(false);
  const [selectedNewContacts, setSelectedNewContacts] = useState<string[]>([]);

  const allContacts = customersData?.contacts || [];
  const existingContactIds = campaignContacts?.map(cc => cc.contact_id) || [];
  const availableContacts = allContacts.filter(c => !existingContactIds.includes(c.id));

  const handleStatusChange = async (status: CampaignStatus) => {
    if (!id) return;
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({
        title: 'Campaign updated',
        description: `Campaign is now ${status}`,
      });
    } catch (error) {
      toast({ title: 'Failed to update campaign', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await deleteCampaign.mutateAsync(id);
      toast({ title: 'Campaign deleted' });
      navigate('/dashboard/campaigns');
    } catch (error) {
      toast({ title: 'Failed to delete campaign', variant: 'destructive' });
    }
  };

  const handleAddContacts = async () => {
    if (!id || selectedNewContacts.length === 0) return;
    try {
      await addContacts.mutateAsync({ campaignId: id, contactIds: selectedNewContacts });
      toast({ title: `Added ${selectedNewContacts.length} contacts` });
      setSelectedNewContacts([]);
      setIsAddContactsOpen(false);
    } catch (error) {
      toast({ title: 'Failed to add contacts', variant: 'destructive' });
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!id || !confirm('Remove this contact from the campaign?')) return;
    try {
      await removeContact.mutateAsync({ campaignId: id, contactId });
      toast({ title: 'Contact removed' });
    } catch (error) {
      toast({ title: 'Failed to remove contact', variant: 'destructive' });
    }
  };

  if (isLoadingCampaign) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
          <Button asChild>
            <Link to="/dashboard/campaigns">Back to Campaigns</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const completionRate = campaign.total_contacts > 0
    ? Math.round((campaign.contacts_completed / campaign.total_contacts) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/dashboard/campaigns">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Campaigns
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
                <Badge variant={statusConfig[campaign.status].variant}>
                  {statusConfig[campaign.status].label}
                </Badge>
              </div>
              {campaign.description && (
                <p className="text-muted-foreground">{campaign.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {campaign.status === 'draft' && (
                <Button onClick={() => handleStatusChange('active')}>
                  <Play className="w-4 h-4 mr-2" />
                  Start Campaign
                </Button>
              )}
              {campaign.status === 'active' && (
                <Button variant="outline" onClick={() => handleStatusChange('paused')}>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              {campaign.status === 'paused' && (
                <>
                  <Button onClick={() => handleStatusChange('active')}>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusChange('completed')}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete
                  </Button>
                </>
              )}
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 md:grid-cols-4"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaign.total_contacts}</p>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaign.contacts_called}</p>
                  <p className="text-sm text-muted-foreground">Called</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <PhoneCall className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaign.contacts_connected}</p>
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Target className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Schedule Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Campaign Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {campaign.calling_hours_start} - {campaign.calling_hours_end}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {campaign.calling_days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Max {campaign.max_attempts} attempts per contact
                </div>
              </div>
              {campaign.first_message && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-1">First Message:</p>
                  <p className="text-sm text-muted-foreground">{campaign.first_message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Contacts Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Campaign Contacts</CardTitle>
                <Button size="sm" onClick={() => setIsAddContactsOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contacts
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingContacts ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !campaignContacts || campaignContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No contacts in this campaign</p>
                  <Button onClick={() => setIsAddContactsOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contacts
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Last Attempt</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignContacts.map(cc => (
                      <TableRow key={cc.id}>
                        <TableCell className="font-medium">
                          {cc.contact?.name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          {cc.contact?.phone ? formatPhoneDisplay(cc.contact.phone) : '-'}
                        </TableCell>
                        <TableCell>
                          <span className={contactStatusConfig[cc.status]?.color || ''}>
                            {contactStatusConfig[cc.status]?.label || cc.status}
                          </span>
                          {cc.outcome && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({cc.outcome})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{cc.attempts}</TableCell>
                        <TableCell>
                          {cc.last_attempt_at
                            ? formatDistanceToNow(new Date(cc.last_attempt_at), { addSuffix: true })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveContact(cc.contact_id)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Add Contacts Dialog */}
      <Dialog open={isAddContactsOpen} onOpenChange={setIsAddContactsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contacts</DialogTitle>
            <DialogDescription>
              Select contacts to add to this campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableContacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">All contacts are already in this campaign</p>
              </div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {availableContacts.map(contact => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedNewContacts.includes(contact.id)}
                      onCheckedChange={() => {
                        setSelectedNewContacts(prev =>
                          prev.includes(contact.id)
                            ? prev.filter(id => id !== contact.id)
                            : [...prev, contact.id]
                        );
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{contact.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddContactsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddContacts}
              disabled={selectedNewContacts.length === 0 || addContacts.isPending}
            >
              {addContacts.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add {selectedNewContacts.length} Contact{selectedNewContacts.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
