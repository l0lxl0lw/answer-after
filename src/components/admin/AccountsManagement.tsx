import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle, Loader2, Building2, Phone, Calendar, CreditCard, Search } from 'lucide-react';
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

interface Account {
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
  account_agents: { elevenlabs_agent_id: string | null }[];
  users: { email: string; full_name: string | null }[];
}

const REFRESH_INTERVAL = 10000; // 10 seconds

const AccountsManagement = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;

    const query = searchQuery.toLowerCase();
    return accounts.filter((account) => {
      const user = account.users?.[0];
      const phoneNumber = account.phone_numbers?.[0];

      return (
        account.name.toLowerCase().includes(query) ||
        account.slug.toLowerCase().includes(query) ||
        account.id.toLowerCase().includes(query) ||
        user?.email?.toLowerCase().includes(query) ||
        user?.full_name?.toLowerCase().includes(query) ||
        phoneNumber?.phone_number?.includes(query)
      );
    });
  }, [accounts, searchQuery]);

  const fetchAccounts = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      console.log('[AccountsManagement] Fetching accounts', { isRefresh });

      // Call admin endpoint which uses service role to bypass RLS
      const { data, error } = await supabase.functions.invoke('admin-list-accounts', {
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch accounts');
      }

      setAccounts(data?.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Start/stop auto-refresh based on visibility
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) return; // Already running
    intervalRef.current = setInterval(() => {
      fetchAccounts(true);
    }, REFRESH_INTERVAL);
  }, [fetchAccounts]);

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initial fetch and auto-refresh when tab is visible
  useEffect(() => {
    fetchAccounts();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAccounts(true);
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    };

    // Start auto-refresh if tab is currently visible
    if (document.visibilityState === 'visible') {
      startAutoRefresh();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopAutoRefresh();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAccounts, startAutoRefresh, stopAutoRefresh]);

  const handleDeleteClick = (account: Account) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAccount) return;

    try {
      setDeleting(true);

      // Call the delete edge function
      const { error } = await supabase.functions.invoke('admin-delete-account', {
        body: {
          accountId: selectedAccount.id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete account');
      }

      toast({
        title: 'Success',
        description: `Account "${selectedAccount.name}" has been deleted`,
      });

      // Refresh the list
      await fetchAccounts();
      setDeleteDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete account',
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
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Manage all accounts in the system. Total: {accounts.length}
            {searchQuery && ` (showing ${filteredAccounts.length})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, slug, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? 'No accounts match your search' : 'No accounts found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAccounts.map((account) => {
                const subscription = account.subscriptions?.[0];
                const agent = account.account_agents?.[0];
                const phoneNumber = account.phone_numbers?.[0];
                const user = account.users?.[0];

                return (
                  <Card key={account.id} className="border-slate-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{account.name}</h3>
                              {account.is_onboarding_complete ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Onboarding</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">/{account.slug}</p>
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
                              <span>{new Date(account.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {agent?.elevenlabs_agent_id && (
                            <p className="text-xs text-slate-500">
                              ElevenLabs Agent: {agent.elevenlabs_agent_id}
                            </p>
                          )}

                          <p className="text-xs text-slate-400 font-mono">{account.id}</p>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(account)}
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
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete <strong>{selectedAccount?.name}</strong>?
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
                'Delete Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AccountsManagement;
