import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Check, 
  Loader2,
  Puzzle,
  AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGoogleCalendarConnection } from '@/hooks/useGoogleCalendarConnection';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function Integrations() {
  const location = useLocation();
  const { data: calendarConnection, isLoading: calendarLoading, refetch: refetchCalendar } = useGoogleCalendarConnection();
  const [isDisconnectingCalendar, setIsDisconnectingCalendar] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);

  // Check if we were redirected here with a prompt to connect Google
  useEffect(() => {
    if (location.state?.showGooglePrompt) {
      setShowGooglePrompt(true);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      // Get the redirect URL for OAuth callback
      const redirectUrl = `${window.location.origin}/dashboard/calendar/callback`;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'authorize', redirectUrl }
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL returned');
      }
    } catch (error: any) {
      console.error('Error starting Google auth:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to start Google authentication',
        variant: 'destructive',
      });
      setIsConnecting(false);
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

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect third-party services to enhance your workflow
          </p>
        </motion.div>

        {/* Google Connection Required Banner */}
        {showGooglePrompt && !calendarConnection && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert className="border-primary/50 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <strong>Connect your Google account to get started.</strong> We need access to your calendar and contacts to manage appointments and identify callers.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Integrations Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6"
        >
          {/* Google Calendar & Contacts Integration */}
          <Card className={calendarConnection ? '' : showGooglePrompt ? 'border-primary ring-2 ring-primary/20' : 'border-dashed'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar & Contacts
              </CardTitle>
              <CardDescription>
                Sync your appointments and contacts with Google.{' '}
                <Link to="/dashboard/calendar-setup" className="text-primary hover:underline">
                  How to connect →
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <p className="font-medium">
                    {calendarConnection ? 'Google Account Connected' : 'Connect Google Account'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {calendarConnection 
                      ? `Connected as ${calendarConnection.connected_email || 'your account'}`
                      : 'Automatically sync appointments and contacts with Google'
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
                  <Button 
                    variant="outline" 
                    onClick={handleConnectGoogle}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Placeholder */}
          <Card className="border-dashed opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Puzzle className="h-5 w-5" />
                More Integrations Coming Soon
              </CardTitle>
              <CardDescription>
                We're working on adding more integrations to help streamline your workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">
                    Zapier, Slack, QuickBooks, and more
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Stay tuned for upcoming integration options
                  </p>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
