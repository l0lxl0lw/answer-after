import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Phone, Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { useSubscription } from '@/hooks/use-api';
import { useNavigate } from 'react-router-dom';

interface AppointmentRemindersProps {
  appointmentId: string;
  appointmentStart: string;
  organizationId: string;
}

interface Reminder {
  id: string;
  reminder_number: number;
  scheduled_time: string;
  reminder_type: 'call' | 'sms';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  response: 'confirmed' | 'declined' | 'reschedule_requested' | 'no_answer' | null;
  notes: string | null;
}

export function AppointmentReminders({ appointmentId, appointmentStart, organizationId }: AppointmentRemindersProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  // Check if plan has outbound reminders
  const { data: tierData } = useQuery({
    queryKey: ['subscription-tier-reminders', subscription?.plan],
    queryFn: async () => {
      if (!subscription?.plan) return null;
      const { data } = await supabase
        .from('subscription_tiers')
        .select('has_outbound_reminders')
        .eq('plan_id', subscription.plan)
        .single();
      return data;
    },
    enabled: !!subscription?.plan,
  });

  const hasRemindersFeature = tierData?.has_outbound_reminders === true;

  // Fetch existing reminders
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['appointment-reminders', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_reminders')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('reminder_number', { ascending: true });

      if (error) throw error;
      return data as Reminder[];
    },
    enabled: hasRemindersFeature,
  });

  // Add reminder mutation
  const addReminderMutation = useMutation({
    mutationFn: async (scheduledTime: string) => {
      const reminderNumber = (reminders?.length || 0) + 1;
      if (reminderNumber > 3) throw new Error('Maximum 3 reminders allowed');

      const { data, error } = await supabase
        .from('appointment_reminders')
        .insert({
          appointment_id: appointmentId,
          organization_id: organizationId,
          reminder_number: reminderNumber,
          scheduled_time: scheduledTime,
          reminder_type: 'call',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-reminders', appointmentId] });
      toast({ title: 'Reminder added successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add reminder', description: error.message, variant: 'destructive' });
    },
  });

  // Delete reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('appointment_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-reminders', appointmentId] });
      toast({ title: 'Reminder removed' });
    },
    onError: (error) => {
      toast({ title: 'Failed to remove reminder', description: error.message, variant: 'destructive' });
    },
  });

  // Trigger manual call mutation
  const triggerCallMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { data, error } = await supabase.functions.invoke('outbound-reminder-call', {
        body: { reminderId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-reminders', appointmentId] });
      toast({ title: 'Reminder call initiated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to initiate call', description: error.message, variant: 'destructive' });
    },
  });

  const [newReminderTime, setNewReminderTime] = useState('');

  // Set default time to 24 hours before appointment
  useEffect(() => {
    const appointmentDate = new Date(appointmentStart);
    const defaultReminder = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    setNewReminderTime(format(defaultReminder, "yyyy-MM-dd'T'HH:mm"));
  }, [appointmentStart]);

  const getStatusBadge = (status: string, response: string | null) => {
    if (status === 'completed' && response) {
      const responseMap: Record<string, { variant: 'default' | 'destructive' | 'secondary'; label: string; icon: React.ReactNode }> = {
        confirmed: { variant: 'default', label: 'Confirmed', icon: <CheckCircle className="h-3 w-3" /> },
        declined: { variant: 'destructive', label: 'Declined', icon: <XCircle className="h-3 w-3" /> },
        reschedule_requested: { variant: 'secondary', label: 'Reschedule', icon: <Clock className="h-3 w-3" /> },
        no_answer: { variant: 'secondary', label: 'No Answer', icon: <AlertCircle className="h-3 w-3" /> },
      };
      const config = responseMap[response] || { variant: 'secondary' as const, label: response, icon: null };
      return (
        <Badge variant={config.variant} className="gap-1">
          {config.icon}
          {config.label}
        </Badge>
      );
    }

    const statusMap: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'secondary', label: 'Completed' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' },
    };
    const config = statusMap[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (subLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  if (!hasRemindersFeature) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Crown className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <h3 className="font-medium mb-1">Outbound Reminder Calls</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Automatically call customers to confirm appointments with AI voice calls.
            </p>
            <Button variant="outline" onClick={() => navigate('/dashboard/subscriptions')}>
              Upgrade to Pro
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canAddMore = (reminders?.length || 0) < 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Reminder Calls
          <Badge variant="secondary" className="ml-auto">
            {reminders?.length || 0}/3
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse h-12 bg-muted rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* Existing reminders */}
            {reminders && reminders.length > 0 ? (
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <div className="font-medium">
                          Reminder #{reminder.reminder_number}
                        </div>
                        <div className="text-muted-foreground">
                          {format(new Date(reminder.scheduled_time), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(reminder.status, reminder.response)}
                      {reminder.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerCallMutation.mutate(reminder.id)}
                            disabled={triggerCallMutation.isPending}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReminderMutation.mutate(reminder.id)}
                            disabled={deleteReminderMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No reminders scheduled
              </p>
            )}

            {/* Add new reminder */}
            {canAddMore && (
              <div className="flex items-end gap-2 pt-2 border-t">
                <div className="flex-1">
                  <Label htmlFor="reminder-time" className="text-xs">
                    Schedule reminder at
                  </Label>
                  <Input
                    id="reminder-time"
                    type="datetime-local"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    max={appointmentStart.slice(0, 16)}
                  />
                </div>
                <Button
                  onClick={() => {
                    if (newReminderTime) {
                      addReminderMutation.mutate(new Date(newReminderTime).toISOString());
                    }
                  }}
                  disabled={!newReminderTime || addReminderMutation.isPending}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
