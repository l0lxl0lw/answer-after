import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Save, Loader2, MessageCircle, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-api';

const MAX_GREETING_WORDS = 100;
const MAX_CONTENT_WORDS = 4000;

export default function MyAgent() {
  const { user } = useAuth();
  const { data: subscription } = useSubscription();
  
  const [customGreeting, setCustomGreeting] = useState('');
  const [agentContent, setAgentContent] = useState('');
  
  const [isSavingGreeting, setIsSavingGreeting] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [hasCustomAgentAccess, setHasCustomAgentAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has custom agent access based on subscription tier
  useEffect(() => {
    const checkCustomAgentAccess = async () => {
      if (!subscription?.plan) {
        setHasCustomAgentAccess(false);
        setIsLoading(false);
        return;
      }
      
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('has_custom_agent')
        .eq('plan_id', subscription.plan)
        .maybeSingle();
      
      setHasCustomAgentAccess(tier?.has_custom_agent ?? false);
      setIsLoading(false);
    };
    
    checkCustomAgentAccess();
  }, [subscription?.plan]);

  // Fetch existing agent data
  useEffect(() => {
    const fetchAgentData = async () => {
      if (!user?.organization_id) return;
      
      const { data, error } = await supabase
        .from('organization_agents')
        .select('context')
        .eq('organization_id', user.organization_id)
        .maybeSingle();
      
      if (!error && data?.context) {
        try {
          const parsed = JSON.parse(data.context);
          setCustomGreeting(parsed.greeting || '');
          setAgentContent(parsed.content || '');
        } catch {
          setAgentContent(data.context);
        }
      }
    };
    
    fetchAgentData();
  }, [user?.organization_id]);

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const saveAgentData = async (greeting: string, content: string) => {
    if (!user?.organization_id) return;
    
    const contextData = JSON.stringify({ greeting, content });

    const { data: existingAgent } = await supabase
      .from('organization_agents')
      .select('id, elevenlabs_agent_id')
      .eq('organization_id', user.organization_id)
      .maybeSingle();

    if (existingAgent) {
      const { error } = await supabase
        .from('organization_agents')
        .update({ context: contextData })
        .eq('organization_id', user.organization_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('organization_agents')
        .insert({ organization_id: user.organization_id, context: contextData });
      if (error) throw error;
    }

    // Update ElevenLabs agent if one exists
    if (existingAgent?.elevenlabs_agent_id) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.functions.invoke('elevenlabs-agent', {
          body: { 
            action: 'update-agent',
            organizationId: user.organization_id,
            context: contextData 
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
      }
    }
  };

  const handleSaveGreeting = async () => {
    if (!user?.organization_id) return;
    
    const wordCount = getWordCount(customGreeting);
    if (wordCount > MAX_GREETING_WORDS) {
      toast({
        title: 'Greeting too long',
        description: `Greeting has ${wordCount} words. Maximum is ${MAX_GREETING_WORDS} words.`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSavingGreeting(true);
    try {
      await saveAgentData(customGreeting, agentContent);
      
      // Generate TTS for the greeting and save to storage
      if (customGreeting.trim()) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data, error } = await supabase.functions.invoke('generate-greeting-tts', {
            body: { 
              greeting: customGreeting,
              organizationId: user.organization_id
            },
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          });
          
          if (error) {
            console.error('TTS generation error:', error);
            toast({ 
              title: 'Greeting saved', 
              description: 'Text saved but audio generation failed.',
              variant: 'default' 
            });
          } else {
            toast({ 
              title: 'Greeting saved', 
              description: 'Your greeting has been saved and audio generated.' 
            });
          }
        }
      } else {
        toast({ title: 'Greeting saved', description: 'Your custom greeting has been updated.' });
      }
    } catch (error: any) {
      toast({ title: 'Error saving greeting', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingGreeting(false);
    }
  };

  const handleSaveContent = async () => {
    if (!user?.organization_id) return;
    
    const wordCount = getWordCount(agentContent);
    if (wordCount > MAX_CONTENT_WORDS) {
      toast({
        title: 'Content too long',
        description: `Content has ${wordCount} words. Maximum is ${MAX_CONTENT_WORDS} words.`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSavingContent(true);
    try {
      await saveAgentData(customGreeting, agentContent);
      toast({ title: 'Content saved', description: 'Your agent content has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error saving content', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingContent(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasCustomAgentAccess) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground">My Agent</h1>
            <p className="text-muted-foreground mt-1">Customize your AI voice agent</p>
          </motion.div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upgrade to Customize Your Agent</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Custom AI agent configuration is available on Pro plans and above. Upgrade to personalize how your agent greets callers and handles conversations.
              </p>
              <Button asChild>
                <a href="/dashboard/subscriptions">View Plans</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">My Agent</h1>
          <p className="text-muted-foreground mt-1">Customize your AI voice agent's behavior</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Custom Greeting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Custom Greeting
              </CardTitle>
              <CardDescription>
                The initial message your AI agent says when answering calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[100px] resize-y"
                placeholder="Example: Hello! Thank you for calling ABC Plumbing. How can I help you today?"
                value={customGreeting}
                onChange={(e) => setCustomGreeting(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <span className={`text-sm ${getWordCount(customGreeting) > MAX_GREETING_WORDS ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {getWordCount(customGreeting)} / {MAX_GREETING_WORDS} words
                </span>
                <Button onClick={handleSaveGreeting} disabled={isSavingGreeting}>
                  {isSavingGreeting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Greeting
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Agent Knowledge & Instructions
              </CardTitle>
              <CardDescription>
                Provide details about your business, services, pricing, and how the agent should handle calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="min-h-[300px] resize-y"
                placeholder="Example:
About the business:
We are ABC Plumbing, serving the Dallas area since 1985.

Services and pricing:
- Emergency repairs: $149 call-out fee
- Water heater installation: Starting at $899
- Drain cleaning: $75

How to handle calls:
- Always be friendly and professional
- Ask for caller's name and phone number
- For emergencies, collect address immediately"
                value={agentContent}
                onChange={(e) => setAgentContent(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <span className={`text-sm ${getWordCount(agentContent) > MAX_CONTENT_WORDS ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {getWordCount(agentContent)} / {MAX_CONTENT_WORDS} words
                </span>
                <Button onClick={handleSaveContent} disabled={isSavingContent}>
                  {isSavingContent ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Content
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}