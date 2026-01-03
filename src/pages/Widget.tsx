import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAccount } from '@/hooks/use-account';
import { supabase } from '@/lib/supabase';
import {
  Code,
  Copy,
  Check,
  Loader2,
  Save,
  Globe,
  Palette,
  MessageSquare,
} from 'lucide-react';

interface WidgetConfig {
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string;
  buttonText: string;
  greeting: string;
}

const defaultConfig: WidgetConfig = {
  position: 'bottom-right',
  primaryColor: '#6366f1',
  buttonText: 'Talk to us',
  greeting: 'Hi! How can I help you today?',
};

export default function Widget() {
  const { toast } = useToast();
  const { data: account, isLoading, refetch } = useAccount();

  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (account) {
      setEnabled(account.widget_enabled || false);
      if (account.widget_config) {
        setConfig({ ...defaultConfig, ...account.widget_config });
      }
    }
  }, [account]);

  const handleSave = async () => {
    if (!account?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          widget_enabled: enabled,
          widget_config: config,
        })
        .eq('id', account.id);

      if (error) throw error;

      toast({ title: 'Widget settings saved' });
      refetch();
    } catch (error) {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const embedCode = account?.id ? `<script src="${window.location.origin}/widget.js"></script>
<script>
  AnswerAfter.init({
    accountId: '${account.id}',
    position: '${config.position}',
    primaryColor: '${config.primaryColor}'
  });
</script>` : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({ title: 'Embed code copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="text-2xl font-bold tracking-tight">Website Widget</h1>
          <p className="text-muted-foreground">
            Add a voice widget to your website for instant customer support
          </p>
        </motion.div>

        {/* Enable Widget */}
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
                    <Globe className="w-5 h-5" />
                    Enable Widget
                  </CardTitle>
                  <CardDescription>
                    Allow visitors to start voice conversations from your website
                  </CardDescription>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {enabled && (
          <>
            {/* Appearance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Appearance
                  </CardTitle>
                  <CardDescription>
                    Customize how the widget looks on your website
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select
                        value={config.position}
                        onValueChange={(value: 'bottom-right' | 'bottom-left') =>
                          setConfig({ ...config, position: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={config.primaryColor}
                          onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                          className="w-12 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={config.primaryColor}
                          onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                          placeholder="#6366f1"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Button Text</Label>
                    <Input
                      value={config.buttonText}
                      onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                      placeholder="Talk to us"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Greeting */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Greeting Message
                  </CardTitle>
                  <CardDescription>
                    The initial message shown when visitors open the widget
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={config.greeting}
                    onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                    placeholder="Hi! How can I help you today?"
                    rows={3}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Embed Code */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Embed Code
                  </CardTitle>
                  <CardDescription>
                    Add this code to your website before the closing &lt;/body&gt; tag
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
                      <code>{embedCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Note: The widget script will be available after saving your settings.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
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
      </div>
    </DashboardLayout>
  );
}
