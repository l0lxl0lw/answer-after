import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Phone, 
  Bell, 
  CreditCard, 
  Save, 
  Plus, 
  Trash2,
  ExternalLink,
  Check,
  Calendar,
  Loader2,
  Clock
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization, usePhoneNumbers, useSubscription } from '@/hooks/use-api';
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: phoneNumbers, isLoading: phonesLoading, refetch: refetchPhones } = usePhoneNumbers();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: calendarConnection, isLoading: calendarLoading, refetch: refetchCalendar } = useGoogleCalendarConnection();

  const [isDisconnectingCalendar, setIsDisconnectingCalendar] = useState(false);
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState({
    phone_number: '',
    friendly_name: '',
    is_after_hours_only: true,
  });

  const [orgForm, setOrgForm] = useState({
    name: '',
    timezone: (() => {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Check if detected timezone is in our US list
        const usTimezoneValues = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'];
        return usTimezoneValues.includes(detected) ? detected : 'America/Chicago';
      } catch {
        return 'America/Chicago';
      }
    })(),
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    notification_email: '',
    notification_phone: '',
    emergency_keywords: [] as string[],
  });

  const [isSavingOrg, setIsSavingOrg] = useState(false);

  const [notifications, setNotifications] = useState({
    email_new_calls: true,
    email_emergencies: true,
    email_daily_summary: true,
    sms_emergencies: true,
    sms_dispatches: false,
    push_all_calls: false,
    push_emergencies: true,
  });

  const [newKeyword, setNewKeyword] = useState('');

  // US Timezones list
  const usTimezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET - EST/EDT)' },
    { value: 'America/Chicago', label: 'Central Time (CT - CST/CDT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT - MST/MDT)' },
    { value: 'America/Phoenix', label: 'Mountain Standard Time (MST - no DST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT - PST/PDT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKST/AKDT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST - no DST)' },
  ];

  // Handle checkout success redirect
  useEffect(() => {
    if (organization) {
      setOrgForm({
        name: organization.name,
        timezone: organization.timezone,
        business_hours_start: organization.business_hours_start || '08:00',
        business_hours_end: organization.business_hours_end || '17:00',
        notification_email: organization.notification_email || '',
        notification_phone: organization.notification_phone || '',
        emergency_keywords: organization.emergency_keywords || [],
      });
    }
  }, [organization]);

  const handleSaveOrganization = async () => {
    if (!user?.organization_id) return;
    
    setIsSavingOrg(true);
    try {
      // Check if name has changed
      const nameChanged = organization && orgForm.name !== organization.name;
      
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgForm.name,
          timezone: orgForm.timezone,
          business_hours_start: orgForm.business_hours_start,
          business_hours_end: orgForm.business_hours_end,
          notification_email: orgForm.notification_email || null,
          notification_phone: orgForm.notification_phone || null,
          emergency_keywords: orgForm.emergency_keywords,
        })
        .eq('id', user.organization_id);

      if (error) throw error;

      // If name changed, update the ElevenLabs agent name
      if (nameChanged) {
        try {
          const { error: agentError } = await supabase.functions.invoke('elevenlabs-agent', {
            body: {
              action: 'rename-agent',
              organizationId: user.organization_id,
              name: orgForm.name,
            },
          });
          
          if (agentError) {
            console.error('Error renaming agent:', agentError);
            // Don't fail the whole operation, just log it
          }
        } catch (agentErr) {
          console.error('Error calling rename-agent:', agentErr);
        }
      }

      toast({
        title: 'Settings saved',
        description: 'Your organization settings have been updated.',
      });
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Error saving settings',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword && !orgForm.emergency_keywords.includes(newKeyword.toLowerCase())) {
      setOrgForm({
        ...orgForm,
        emergency_keywords: [...orgForm.emergency_keywords, newKeyword.toLowerCase()],
      });
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setOrgForm({
      ...orgForm,
      emergency_keywords: orgForm.emergency_keywords.filter(k => k !== keyword),
    });
  };

  const handleAddPhoneNumber = async () => {
    if (!user?.organization_id) {
      toast({
        title: 'No organization',
        description: 'You need to be part of an organization to add phone numbers.',
        variant: 'destructive',
      });
      return;
    }

    if (!newPhone.phone_number) {
      toast({
        title: 'Phone number required',
        description: 'Please enter a phone number.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingPhone(true);
    try {
      const { error } = await supabase
        .from('phone_numbers')
        .insert({
          organization_id: user.organization_id,
          phone_number: newPhone.phone_number,
          friendly_name: newPhone.friendly_name || newPhone.phone_number,
          is_after_hours_only: newPhone.is_after_hours_only,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'Phone number added',
        description: 'The phone number has been added successfully.',
      });

      setNewPhone({ phone_number: '', friendly_name: '', is_after_hours_only: true });
      setAddPhoneOpen(false);
      refetchPhones();
    } catch (error: any) {
      console.error('Error adding phone number:', error);
      toast({
        title: 'Error adding phone number',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingPhone(false);
    }
  };

  const handleDeletePhoneNumber = async (phoneId: string) => {
    try {
      const { error } = await supabase
        .from('phone_numbers')
        .delete()
        .eq('id', phoneId);

      if (error) throw error;

      toast({
        title: 'Phone number deleted',
        description: 'The phone number has been removed.',
      });

      refetchPhones();
    } catch (error: any) {
      console.error('Error deleting phone number:', error);
      toast({
        title: 'Error deleting phone number',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!calendarConnection) return;
    
    setIsDisconnectingCalendar(true);
    try {
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('id', calendarConnection.id);

      if (error) throw error;

      toast({
        title: 'Calendar disconnected',
        description: 'Google Calendar has been disconnected successfully.',
      });

      refetchCalendar();
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: 'Error disconnecting calendar',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnectingCalendar(false);
    }
  };

  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [searchParams] = useSearchParams();

  // Handle checkout success redirect
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast({
        title: 'Welcome to AnswerAfter!',
        description: 'Your 30-day free trial has started. We\'ll remind you 3 days before it ends.',
      });
      // Clear the query param
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [searchParams]);

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: 'Session expired',
          description: 'Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error || !data?.url) {
        console.error('Portal error:', error);
        toast({
          title: 'Unable to open billing portal',
          description: 'Please try again or contact support.',
          variant: 'destructive',
        });
        return;
      }

      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Billing portal error:', error);
      toast({
        title: 'Error',
        description: 'Unable to open billing portal.',
        variant: 'destructive',
      });
    } finally {
      setIsManagingBilling(false);
    }
  };

  const handleStartTrial = async () => {
    setIsManagingBilling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: 'Session expired',
          description: 'Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const response = await supabase.functions.invoke('create-checkout-with-trial', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      console.log('Checkout response:', response);
      
      const { data, error } = response;
      const url = data?.url;

      if (error) {
        console.error('Checkout function error:', error);
        toast({
          title: 'Unable to start checkout',
          description: error.message || 'Please try again or contact support.',
          variant: 'destructive',
        });
        return;
      }

      if (!url) {
        console.error('No checkout URL in response:', data);
        toast({
          title: 'Unable to start checkout',
          description: 'No checkout URL received. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Error',
        description: 'Unable to start checkout.',
        variant: 'destructive',
      });
    } finally {
      setIsManagingBilling(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPlanPrice = (plan: string) => {
    switch (plan) {
      case 'starter': return '$99';
      case 'professional': return '$199';
      case 'enterprise': return '$499';
      default: return '$99';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization, phone numbers, and preferences
          </p>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="organization" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50">
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Organization</span>
            </TabsTrigger>
            <TabsTrigger value="phones" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Phone Numbers</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
          </TabsList>

          {/* Organization Tab */}
          <TabsContent value="organization">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>
                    Basic information about your business
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Business Name</Label>
                      <Input
                        id="org-name"
                        value={orgForm.name}
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                        placeholder="Your Business Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={orgForm.timezone} onValueChange={(value) => setOrgForm({ ...orgForm, timezone: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {usTimezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="hours-start">Business Hours Start</Label>
                      <Input
                        id="hours-start"
                        type="time"
                        value={orgForm.business_hours_start}
                        onChange={(e) => setOrgForm({ ...orgForm, business_hours_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hours-end">Business Hours End</Label>
                      <Input
                        id="hours-end"
                        type="time"
                        value={orgForm.business_hours_end}
                        onChange={(e) => setOrgForm({ ...orgForm, business_hours_end: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle>Notification Contacts</CardTitle>
                  <CardDescription>
                    Where to send alerts and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="notify-email">Notification Email</Label>
                      <Input
                        id="notify-email"
                        type="email"
                        value={orgForm.notification_email}
                        onChange={(e) => setOrgForm({ ...orgForm, notification_email: e.target.value })}
                        placeholder="owner@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notify-phone">Notification Phone</Label>
                      <Input
                        id="notify-phone"
                        type="tel"
                        value={orgForm.notification_phone}
                        onChange={(e) => setOrgForm({ ...orgForm, notification_phone: e.target.value })}
                        placeholder="+15551234567"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Call Forwarding Keywords */}
              <Card>
                <CardHeader>
                  <CardTitle>Call Forwarding Keywords</CardTitle>
                  <CardDescription>
                    When callers say these words, the AI Agent will transfer the call to your notification phone number
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="e.g., emergency, urgent, speak to someone..."
                      onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    />
                    <Button onClick={handleAddKeyword} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {orgForm.emergency_keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {keyword}
                        <button
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button onClick={handleSaveOrganization} disabled={isSavingOrg}>
                  {isSavingOrg ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          {/* Phone Numbers Tab */}
          <TabsContent value="phones">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Phone Numbers</CardTitle>
                    <CardDescription>
                      Manage your after-hours phone numbers
                    </CardDescription>
                  </div>
                  <Dialog open={addPhoneOpen} onOpenChange={setAddPhoneOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Number
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Phone Number</DialogTitle>
                        <DialogDescription>
                          Add a new phone number for after-hours call handling.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone-number">Phone Number</Label>
                          <Input
                            id="phone-number"
                            placeholder="+15551234567"
                            value={newPhone.phone_number}
                            onChange={(e) => setNewPhone({ ...newPhone, phone_number: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter the phone number in E.164 format (e.g., +15551234567)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="friendly-name">Friendly Name</Label>
                          <Input
                            id="friendly-name"
                            placeholder="Main Line"
                            value={newPhone.friendly_name}
                            onChange={(e) => setNewPhone({ ...newPhone, friendly_name: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="after-hours">After Hours Only</Label>
                          <Switch
                            id="after-hours"
                            checked={newPhone.is_after_hours_only}
                            onCheckedChange={(checked) => setNewPhone({ ...newPhone, is_after_hours_only: checked })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddPhoneOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddPhoneNumber} disabled={isAddingPhone}>
                          {isAddingPhone && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Add Number
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {phonesLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading phone numbers...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {phoneNumbers?.map((phone) => (
                        <div
                          key={phone.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Phone className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{phone.friendly_name}</p>
                              <p className="text-sm text-muted-foreground">{phone.phone_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              {phone.is_after_hours_only && (
                                <Badge variant="outline">After Hours Only</Badge>
                              )}
                              <Badge variant={phone.is_active ? 'default' : 'secondary'}>
                                {phone.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeletePhoneNumber(phone.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Google Calendar Integration */}
              <Card className={calendarConnection ? '' : 'border-dashed'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Google Calendar Integration
                  </CardTitle>
                  <CardDescription>
                    Sync your appointments with Google Calendar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {calendarConnection ? 'Google Calendar Connected' : 'Connect Google Calendar'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {calendarConnection 
                          ? `Connected as ${calendarConnection.connected_email || 'your account'}`
                          : 'Automatically sync appointments with your calendar'
                        }
                      </p>
                    </div>
                    {calendarConnection ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 border-green-500/30">
                          <Check className="h-4 w-4" />
                          Connected
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleDisconnectCalendar}
                          disabled={isDisconnectingCalendar}
                          className="text-destructive hover:text-destructive"
                        >
                          {isDisconnectingCalendar ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Disconnect'
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" asChild>
                        <a href="/calendar-onboarding">
                          Connect
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Email Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>
                    Configure which emails you receive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>New Calls</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive an email for every new after-hours call
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email_new_calls}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email_new_calls: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Emergency Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Immediate email for emergency calls
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email_emergencies}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email_emergencies: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Daily Summary</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive a daily digest of all calls
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email_daily_summary}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email_daily_summary: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* SMS Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>SMS Notifications</CardTitle>
                  <CardDescription>
                    Configure text message alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Emergency Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Immediate SMS for emergency calls
                      </p>
                    </div>
                    <Switch
                      checked={notifications.sms_emergencies}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms_emergencies: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Dispatch Confirmations</Label>
                      <p className="text-sm text-muted-foreground">
                        SMS when a technician is dispatched
                      </p>
                    </div>
                    <Switch
                      checked={notifications.sms_dispatches}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms_dispatches: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Push Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Push Notifications</CardTitle>
                  <CardDescription>
                    Browser and mobile push notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>All Calls</Label>
                      <p className="text-sm text-muted-foreground">
                        Push notification for every call
                      </p>
                    </div>
                    <Switch
                      checked={notifications.push_all_calls}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push_all_calls: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Emergencies Only</Label>
                      <p className="text-sm text-muted-foreground">
                        Only push for emergency calls
                      </p>
                    </div>
                    <Switch
                      checked={notifications.push_emergencies}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push_emergencies: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => toast({ title: 'Notification preferences saved' })}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Current Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>
                    Your subscription details and usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {subLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading subscription...
                    </div>
                  ) : subscription ? (
                    <div className="space-y-6">
                      {/* Trial Banner */}
                      {subscription.status === 'trialing' && (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <Clock className="h-5 w-5 text-amber-500" />
                          <div className="flex-1">
                            <p className="font-medium text-amber-600 dark:text-amber-400">Free Trial Active</p>
                            <p className="text-sm text-muted-foreground">
                              Your trial ends on {formatDate(subscription.current_period_end)}. 
                              You'll be automatically upgraded to the paid plan after.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-semibold capitalize">{subscription.plan}</h3>
                            <Badge 
                              variant={subscription.status === 'trialing' ? 'secondary' : 'default'} 
                              className="flex items-center gap-1"
                            >
                              {subscription.status === 'trialing' ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Trial
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3" />
                                  {subscription.status}
                                </>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {subscription.status === 'trialing' 
                              ? `${getPlanPrice(subscription.plan)}/month after trial` 
                              : `${getPlanPrice(subscription.plan)}/month`}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={handleManageBilling}
                          disabled={isManagingBilling}
                        >
                          {isManagingBilling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              Manage Subscription
                              <ExternalLink className="h-4 w-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">
                            {subscription.status === 'trialing' ? 'Trial Period' : 'Current Period'}
                          </p>
                          <p className="font-medium mt-1">
                            {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">
                            {subscription.status === 'trialing' ? 'First Billing Date' : 'Next Billing Date'}
                          </p>
                          <p className="font-medium mt-1">
                            {subscription.cancel_at_period_end 
                              ? 'Canceling at period end' 
                              : formatDate(subscription.current_period_end)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 space-y-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">No active subscription</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Start your 30-day free trial to unlock all features
                        </p>
                      </div>
                      <Button onClick={handleStartTrial} disabled={isManagingBilling}>
                        {isManagingBilling ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          'Start Free Trial'
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Plan Features */}
              <Card>
                <CardHeader>
                  <CardTitle>Plan Features</CardTitle>
                  <CardDescription>
                    What's included in your {subscription?.plan || 'plan'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {[
                      'Unlimited after-hours calls',
                      'AI-powered call handling',
                      'Real-time technician dispatch',
                      'Call recording & transcription',
                      'Appointment scheduling',
                      'Priority support',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Usage Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>This Month's Usage</CardTitle>
                  <CardDescription>
                    Your usage for the current billing period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-primary">47</p>
                      <p className="text-sm text-muted-foreground mt-1">Total Calls</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-primary">12</p>
                      <p className="text-sm text-muted-foreground mt-1">Emergency Dispatches</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-primary">4.2h</p>
                      <p className="text-sm text-muted-foreground mt-1">Talk Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
