import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Save, Loader2, Check, MessageCircle, DollarSign, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-api';

const MAX_WORDS = 5000;

export default function MyAgent() {
  const { user } = useAuth();
  const { data: subscription } = useSubscription();
  
  const [greetingMessage, setGreetingMessage] = useState('');
  const [pricingOffering, setPricingOffering] = useState('');
  const [agentBehavior, setAgentBehavior] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [agentData, setAgentData] = useState<{ elevenlabs_agent_id: string | null; context: string | null } | null>(null);
  const [hasCustomAgentAccess, setHasCustomAgentAccess] = useState(false);

  // Check if user has custom agent access based on subscription tier
  useEffect(() => {
    const checkCustomAgentAccess = async () => {
      if (!subscription?.plan) {
        setHasCustomAgentAccess(false);
        return;
      }
      
      const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('has_custom_agent')
        .eq('plan_id', subscription.plan)
        .maybeSingle();
      
      setHasCustomAgentAccess(tier?.has_custom_agent ?? false);
    };
    
    checkCustomAgentAccess();
  }, [subscription?.plan]);

  // Fetch organization agent data
  useEffect(() => {
    const fetchAgentData = async () => {
      if (!user?.organization_id) return;
      
      const { data, error } = await supabase
        .from('organization_agents')
        .select('elevenlabs_agent_id, context')
        .eq('organization_id', user.organization_id)
        .maybeSingle();
      
      if (!error && data) {
        setAgentData(data);
        // Parse context if it exists
        if (data.context) {
          try {
            const parsed = JSON.parse(data.context);
            setGreetingMessage(parsed.greeting || '');
            setPricingOffering(parsed.pricing || '');
            setAgentBehavior(parsed.behavior || '');
          } catch {
            // If not JSON, treat as legacy format
            setAgentBehavior(data.context);
          }
        }
      }
    };
    
    fetchAgentData();
  }, [user?.organization_id]);

  const getTotalWordCount = () => {
    const allText = `${greetingMessage} ${pricingOffering} ${agentBehavior}`.trim();
    return allText.split(/\s+/).filter(Boolean).length;
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleSaveAll = async () => {
    if (!user?.organization_id) return;
    
    const totalWords = getTotalWordCount();
    if (totalWords > MAX_WORDS) {
      toast({
        title: 'Content too long',
        description: `Total content has ${totalWords} words. Maximum is ${MAX_WORDS} words.`,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const contextData = JSON.stringify({
        greeting: greetingMessage,
        pricing: pricingOffering,
        behavior: agentBehavior,
      });

      // Check if organization_agents record exists
      const { data: existingAgent } = await supabase
        .from('organization_agents')
        .select('id')
        .eq('organization_id', user.organization_id)
        .maybeSingle();

      if (existingAgent) {
        // Update existing record
        const { error } = await supabase
          .from('organization_agents')
          .update({ context: contextData })
          .eq('organization_id', user.organization_id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('organization_agents')
          .insert({ 
            organization_id: user.organization_id,
            context: contextData 
          });
        
        if (error) throw error;
      }
      
      toast({
        title: 'Agent settings saved',
        description: 'Your AI agent configuration has been updated.',
      });
      
      setAgentData(prev => prev ? { ...prev, context: contextData } : { elevenlabs_agent_id: null, context: contextData });

      // If agent exists, update it
      if (agentData?.elevenlabs_agent_id) {
        await handleUpdateAgent();
      }
    } catch (error: any) {
      console.error('Error saving agent settings:', error);
      toast({
        title: 'Error saving settings',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAgent = async () => {
    if (!user?.organization_id) return;
    
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

      const contextData = JSON.stringify({
        greeting: greetingMessage,
        pricing: pricingOffering,
        behavior: agentBehavior,
      });

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent', {
        body: { 
          action: 'create-agent',
          organizationId: user.organization_id,
          context: contextData 
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.agent_id) {
        toast({
          title: 'Agent updated',
          description: 'Your AI voice agent has been updated successfully.',
        });
        
        setAgentData(prev => prev ? { ...prev, elevenlabs_agent_id: data.agent_id } : { elevenlabs_agent_id: data.agent_id, context: null });
      }
    } catch (error: any) {
      console.error('Error updating agent:', error);
      // Don't show error toast here as main save was successful
    }
  };

  const handleCreateAgent = async () => {
    if (!user?.organization_id) return;
    
    // First save the content
    await handleSaveAll();
    
    setIsCreatingAgent(true);
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

      const contextData = JSON.stringify({
        greeting: greetingMessage,
        pricing: pricingOffering,
        behavior: agentBehavior,
      });

      const { data, error } = await supabase.functions.invoke('elevenlabs-agent', {
        body: { 
          action: 'create-agent',
          organizationId: user.organization_id,
          context: contextData 
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.agent_id) {
        toast({
          title: 'Agent created',
          description: 'Your AI voice agent has been created successfully.',
        });
        
        setAgentData(prev => prev ? { ...prev, elevenlabs_agent_id: data.agent_id } : { elevenlabs_agent_id: data.agent_id, context: contextData });
      }
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast({
        title: 'Error creating agent',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingAgent(false);
    }
  };

  if (!hasCustomAgentAccess) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl font-bold text-foreground">My Agent</h1>
            <p className="text-muted-foreground mt-1">
              Customize your AI voice agent
            </p>
          </motion.div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upgrade to Customize Your Agent</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Custom AI agent configuration is available on Pro plans and above. Upgrade to personalize how your agent greets callers, describes your services, and handles conversations.
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Agent</h1>
            <p className="text-muted-foreground mt-1">
              Customize your AI voice agent's behavior and responses
            </p>
          </div>
          <div className="flex items-center gap-2">
            {agentData?.elevenlabs_agent_id && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Check className="h-3 w-3 mr-1" />
                Agent Active
              </Badge>
            )}
          </div>
        </motion.div>

        {/* Total Word Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Total words: {getTotalWordCount()} / {MAX_WORDS}
          </span>
          {getTotalWordCount() > MAX_WORDS && (
            <Badge variant="destructive">Exceeds limit</Badge>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Initial Greeting Message */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Initial Greeting Message
              </CardTitle>
              <CardDescription>
                How your AI agent should greet callers when they first connect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  className="min-h-[120px] resize-y"
                  placeholder="Example: Hello! Thank you for calling ABC Plumbing. I'm your AI assistant. How can I help you today?"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                />
                <div className="text-sm text-muted-foreground text-right">
                  {getWordCount(greetingMessage)} words
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Offering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Services
              </CardTitle>
              <CardDescription>
                Describe your services, pricing, and special offers so the agent can answer questions accurately
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  className="min-h-[200px] resize-y"
                  placeholder="Example:
Services we offer:
- Emergency plumbing repairs (24/7) - $149 call-out fee
- Water heater installation - Starting at $899
- AC and heating maintenance - $89 service call
- Drain cleaning - $75 + materials

Special offers:
- 10% senior citizen discount
- Free estimates for installations
- First-time customer discount: $25 off"
                  value={pricingOffering}
                  onChange={(e) => setPricingOffering(e.target.value)}
                />
                <div className="text-sm text-muted-foreground text-right">
                  {getWordCount(pricingOffering)} words
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent Behavior & Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Agent Behavior & Instructions
              </CardTitle>
              <CardDescription>
                Detailed instructions for how your agent should handle calls, respond to questions, and what information to collect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  className="min-h-[300px] resize-y"
                  placeholder="Example:
About the business:
We are ABC Plumbing & HVAC, serving the Dallas-Fort Worth area since 1985. We pride ourselves on fast, reliable service.

How to handle calls:
- Always be friendly and professional
- Ask for the caller's name and phone number first
- For emergencies, collect address immediately and assure help is on the way
- For scheduling, offer next available appointment slots

Common questions to answer:
- Service area: We cover all of DFW including Dallas, Fort Worth, Arlington, Plano, and surrounding cities
- Hours: 24/7 for emergencies, regular scheduling M-F 8am-6pm
- Payment: We accept all major credit cards, checks, and cash

Special instructions:
- For gas leaks, tell caller to evacuate and call 911 first
- For water main breaks, guide them to shut off main valve
- Always offer to schedule a callback if they need time to decide"
                  value={agentBehavior}
                  onChange={(e) => setAgentBehavior(e.target.value)}
                />
                <div className="text-sm text-muted-foreground text-right">
                  {getWordCount(agentBehavior)} words
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Actions */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline"
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All Settings
            </Button>
            {!agentData?.elevenlabs_agent_id ? (
              <Button 
                onClick={handleCreateAgent}
                disabled={isCreatingAgent || getTotalWordCount() === 0}
              >
                {isCreatingAgent ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                Create AI Agent
              </Button>
            ) : (
              <Button 
                onClick={handleSaveAll}
                disabled={isSaving || getTotalWordCount() === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                Save & Update Agent
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
