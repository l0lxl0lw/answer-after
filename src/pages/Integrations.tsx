import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/hooks/use-account';
import { supabase } from '@/lib/supabase';
import {
  Puzzle,
  Webhook,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Save,
  ExternalLink,
  Code,
} from 'lucide-react';

export default function Integrations() {
  const { toast } = useToast();
  const { data: account, isLoading, refetch } = useAccount();

  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);

  useEffect(() => {
    if (account) {
      setWebhookEnabled(account.webhook_enabled || false);
      setWebhookSecret(account.webhook_secret || '');
    }
  }, [account]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-inbound`;

  const generateSecret = () => {
    return crypto.randomUUID();
  };

  const handleSave = async () => {
    if (!account?.id) return;

    setIsSaving(true);
    try {
      // Generate secret if enabling and no secret exists
      let secret = webhookSecret;
      if (webhookEnabled && !secret) {
        secret = generateSecret();
        setWebhookSecret(secret);
      }

      const { error } = await supabase
        .from('accounts')
        .update({
          webhook_enabled: webhookEnabled,
          webhook_secret: secret || null,
        })
        .eq('id', account.id);

      if (error) throw error;

      toast({ title: 'Webhook settings saved' });
      refetch();
    } catch (error) {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!account?.id) return;

    setIsRegenerating(true);
    try {
      const newSecret = generateSecret();

      const { error } = await supabase
        .from('accounts')
        .update({ webhook_secret: newSecret })
        .eq('id', account.id);

      if (error) throw error;

      setWebhookSecret(newSecret);
      toast({ title: 'Webhook secret regenerated' });
      refetch();
    } catch (error) {
      toast({ title: 'Failed to regenerate secret', variant: 'destructive' });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = async (type: 'url' | 'secret', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    toast({ title: `${type === 'url' ? 'Webhook URL' : 'Secret'} copied` });
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
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

        {/* Webhook Integration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="w-5 h-5" />
                    Webhook API
                  </CardTitle>
                  <CardDescription>
                    Receive data from external services like Zapier, Make, or custom apps
                  </CardDescription>
                </div>
                <Switch
                  checked={webhookEnabled}
                  onCheckedChange={setWebhookEnabled}
                />
              </div>
            </CardHeader>
            {webhookEnabled && (
              <CardContent className="space-y-4">
                {/* Webhook URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="font-mono text-sm bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy('url', webhookUrl)}
                    >
                      {copied === 'url' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Webhook Secret */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook Secret</label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookSecret || 'No secret generated yet'}
                      readOnly
                      className="font-mono text-sm bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => webhookSecret && handleCopy('secret', webhookSecret)}
                      disabled={!webhookSecret}
                    >
                      {copied === 'secret' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRegenerateSecret}
                      disabled={isRegenerating}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Include this as <code className="bg-muted px-1 rounded">X-Webhook-Secret</code> header in your requests
                  </p>
                </div>

                {/* API Documentation */}
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Available Actions
                  </h4>
                  <div className="text-sm space-y-2">
                    <div>
                      <code className="bg-muted px-1 rounded">create_contact</code>
                      <span className="text-muted-foreground ml-2">Create a new contact</span>
                    </div>
                    <div>
                      <code className="bg-muted px-1 rounded">update_contact</code>
                      <span className="text-muted-foreground ml-2">Update an existing contact</span>
                    </div>
                    <div>
                      <code className="bg-muted px-1 rounded">trigger_call</code>
                      <span className="text-muted-foreground ml-2">Trigger an outbound call</span>
                    </div>
                  </div>

                  {/* Example */}
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Example Request:</p>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`POST ${webhookUrl}
X-Webhook-Secret: your-secret-here
Content-Type: application/json

{
  "action": "create_contact",
  "data": {
    "phone": "+15551234567",
    "name": "John Doe",
    "email": "john@example.com"
  }
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </motion.div>

        {/* Save Button */}
        {webhookEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </motion.div>
        )}

        {/* Coming Soon Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
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
