import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle, Loader2, Building2, Phone, Calendar, CreditCard, Search, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_onboarding_complete: boolean;
  business_phone_number: string | null;
  phone_numbers: { phone_number: string }[];
  subscriptions: {
    plan: string;
    status: string;
    stripe_subscription_id: string | null;
  }[];
  organization_agents: { elevenlabs_agent_id: string | null }[];
  profiles: { email: string; full_name: string | null }[];
}

const OrganizationsManagement = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) return organizations;

    const query = searchQuery.toLowerCase();
    return organizations.filter((org) => {
      const user = org.profiles?.[0];
      const phoneNumber = org.phone_numbers?.[0];

      return (
        org.name.toLowerCase().includes(query) ||
        org.slug.toLowerCase().includes(query) ||
        org.id.toLowerCase().includes(query) ||
        user?.email?.toLowerCase().includes(query) ||
        user?.full_name?.toLowerCase().includes(query) ||
        phoneNumber?.phone_number?.includes(query)
      );
    });
  }, [organizations, searchQuery]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrganizations(true);
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Organization list has been updated',
    });
  };

  const fetchOrganizations = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      // Call admin endpoint which uses service role to bypass RLS
      const { data, error } = await supabase.functions.invoke('admin-list-organizations', {
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch organizations');
      }

      setOrganizations(data?.data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (org: Organization) => {
    setSelectedOrg(org);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedOrg) return;

    try {
      setDeleting(true);

      // Call the delete edge function
      const { error } = await supabase.functions.invoke('admin-delete-organization', {
        body: {
          organizationId: selectedOrg.id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete organization');
      }

      toast({
        title: 'Success',
        description: `Organization "${selectedOrg.name}" has been deleted`,
      });

      // Refresh the list
      await fetchOrganizations();
      setDeleteDialogOpen(false);
      setSelectedOrg(null);
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete organization',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Manage all organizations in the system. Total: {organizations.length}
            {searchQuery && ` (showing ${filteredOrganizations.length})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, slug, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {filteredOrganizations.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? 'No organizations match your search' : 'No organizations found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrganizations.map((org) => {
                const subscription = org.subscriptions?.[0];
                const agent = org.organization_agents?.[0];
                const phoneNumber = org.phone_numbers?.[0];
                const user = org.profiles?.[0];

                return (
                  <Card key={org.id} className="border-slate-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{org.name}</h3>
                              {org.is_onboarding_complete ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Onboarding</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">/{org.slug}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {user && (
                              <div className="flex items-center gap-2 text-slate-600">
                                <Building2 className="h-4 w-4" />
                                <span>{user.full_name || user.email}</span>
                              </div>
                            )}

                            {phoneNumber && (
                              <div className="flex items-center gap-2 text-slate-600">
                                <Phone className="h-4 w-4" />
                                <span>{phoneNumber.phone_number}</span>
                              </div>
                            )}

                            {subscription && (
                              <div className="flex items-center gap-2 text-slate-600">
                                <CreditCard className="h-4 w-4" />
                                <span className="capitalize">{subscription.plan} - {subscription.status}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-slate-600">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(org.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {agent?.elevenlabs_agent_id && (
                            <p className="text-xs text-slate-500">
                              ElevenLabs Agent: {agent.elevenlabs_agent_id}
                            </p>
                          )}

                          <p className="text-xs text-slate-400 font-mono">{org.id}</p>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(org)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete <strong>{selectedOrg?.name}</strong>?
              </p>
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>
                  This will permanently delete:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>All database records (calls, appointments, transcripts, etc.)</li>
                    <li>ElevenLabs AI agent</li>
                    <li>User profiles and roles</li>
                    <li>Services and settings</li>
                    <li>Phone number database records</li>
                  </ul>
                  <p className="mt-2 font-semibold text-amber-700">
                    Note: Twilio phone numbers remain in your Twilio account for manual reuse/reassignment.
                  </p>
                </AlertDescription>
              </Alert>
              <p className="text-sm text-slate-600 mt-3">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrganizationsManagement;
