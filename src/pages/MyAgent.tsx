import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Save, Loader2, MessageCircle, FileText, Mic, Play, Square, Crown } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-api';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

// Import voice preview audio files
import vedaSkyPreview from '@/assets/voices/veda_sky.mp3';
import matildaPreview from '@/assets/voices/matilda.mp3';
import michaelPreview from '@/assets/voices/michael.mp3';

const MAX_GREETING_WORDS = 100;
const MAX_CONTENT_WORDS = 4000;

// Hardcoded voices with their ElevenLabs voice IDs
const VOICES = [
  {
    id: 'veda_sky',
    name: 'Veda Sky',
    elevenlabs_voice_id: '625jGFaa0zTLtQfxwc6Q',
    description: 'Customer care agent voice',
    preview_url: vedaSkyPreview,
  },
  {
    id: 'matilda',
    name: 'Matilda',
    elevenlabs_voice_id: 'XrExE9yKIg1WjnnlVkGX',
    description: 'Warm and friendly female voice',
    preview_url: matildaPreview,
  },
  {
    id: 'michael',
    name: 'Michael',
    elevenlabs_voice_id: 'ljX1ZrXuDIIRVcmiVSyR',
    description: 'Friendly male voice',
    preview_url: michaelPreview,
  },
] as const;

type VoiceId = typeof VOICES[number]['id'];

// Singleton audio instance for previews
let previewAudio: HTMLAudioElement | null = null;

export default function MyAgent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: subscription } = useSubscription();
  
  const [customGreeting, setCustomGreeting] = useState('');
  const [agentContent, setAgentContent] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<VoiceId>('veda_sky');
  const [playingVoiceId, setPlayingVoiceId] = useState<VoiceId | null>(null);
  
  const [isSavingGreeting, setIsSavingGreeting] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [hasCustomAgentAccess, setHasCustomAgentAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check tier for context access (Pro+)
  const { data: tierData } = useQuery({
    queryKey: ['subscription-tier-agent', subscription?.plan],
    queryFn: async () => {
      if (!subscription?.plan) return null;
      const { data } = await supabase
        .from('subscription_tiers')
        .select('has_custom_agent, has_outbound_reminders')
        .eq('plan_id', subscription.plan)
        .single();
      return data;
    },
    enabled: !!subscription?.plan,
  });

  // Context editing requires Pro+ (has_outbound_reminders is true for Pro+)
  const hasContextAccess = tierData?.has_outbound_reminders === true;

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
      
      if (!error && data) {
        if (data.context) {
          try {
            const parsed = JSON.parse(data.context);
            setCustomGreeting(parsed.greeting || '');
            setAgentContent(parsed.content || '');
            // Load saved voice (defaults to veda_sky if not set)
            if (parsed.voiceId && VOICES.some(v => v.id === parsed.voiceId)) {
              setSelectedVoiceId(parsed.voiceId);
            } else {
              setSelectedVoiceId('veda_sky');
            }
          } catch {
            setAgentContent(data.context);
          }
        }
      }
    };
    
    fetchAgentData();
  }, [user?.organization_id]);

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const saveAgentData = async (greeting: string, content: string, voiceId?: VoiceId | null) => {
    if (!user?.organization_id) return;
    
    const contextData = JSON.stringify({ greeting, content, voiceId: voiceId || selectedVoiceId });

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

    return existingAgent;
  };

  const updateElevenLabsAgent = async (voiceId?: VoiceId | null) => {
    if (!user?.organization_id) return;
    
    const { data: existingAgent } = await supabase
      .from('organization_agents')
      .select('elevenlabs_agent_id')
      .eq('organization_id', user.organization_id)
      .maybeSingle();

    if (existingAgent?.elevenlabs_agent_id) {
      const voice = voiceId ? VOICES.find(v => v.id === voiceId) : null;
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.functions.invoke('elevenlabs-agent', {
          body: { 
            action: 'update-agent',
            organizationId: user.organization_id,
            context: JSON.stringify({ 
              greeting: customGreeting, 
              content: agentContent, 
              voiceId: voiceId || selectedVoiceId 
            }),
            voiceId: voice?.elevenlabs_voice_id
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
          const { error } = await supabase.functions.invoke('generate-greeting-tts', {
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
            await updateElevenLabsAgent();
            toast({ 
              title: 'Greeting saved', 
              description: 'Your greeting has been saved and audio generated.' 
            });
          }
        }
      } else {
        await updateElevenLabsAgent();
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
      await updateElevenLabsAgent();
      toast({ title: 'Content saved', description: 'Your agent content has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error saving content', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleSaveVoice = async () => {
    if (!user?.organization_id || !selectedVoiceId) return;
    
    setIsSavingVoice(true);
    try {
      await saveAgentData(customGreeting, agentContent, selectedVoiceId);
      await updateElevenLabsAgent(selectedVoiceId);
      toast({ title: 'Voice saved', description: 'Your agent voice has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error saving voice', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingVoice(false);
    }
  };

  const handlePreviewVoice = (voiceId: VoiceId) => {
    const voice = VOICES.find(v => v.id === voiceId);
    if (!voice) return;

    // If currently playing this voice, stop it
    if (playingVoiceId === voiceId) {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      }
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    // Create new audio and play
    previewAudio = new Audio(voice.preview_url);
    previewAudio.onended = () => setPlayingVoiceId(null);
    previewAudio.onerror = () => {
      setPlayingVoiceId(null);
      toast({ title: 'Playback error', description: 'Failed to play audio preview.', variant: 'destructive' });
    };
    
    previewAudio.play();
    setPlayingVoiceId(voiceId);
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
                Custom AI agent configuration is available on Growth plans and above. Upgrade to personalize how your agent greets callers and handles conversations.
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

          {/* Agent Voice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Agent Voice
              </CardTitle>
              <CardDescription>
                Select the voice your AI agent will use when speaking to callers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedVoiceId || ''} onValueChange={(value) => setSelectedVoiceId(value as VoiceId)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col">
                        <span>{voice.name}</span>
                        <span className="text-xs text-muted-foreground">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-between items-center">
                {selectedVoiceId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePreviewVoice(selectedVoiceId)}
                  >
                    {playingVoiceId === selectedVoiceId ? (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop Preview
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Preview Voice
                      </>
                    )}
                  </Button>
                )}
                <div className={selectedVoiceId ? '' : 'ml-auto'}>
                  <Button onClick={handleSaveVoice} disabled={isSavingVoice || !selectedVoiceId}>
                    {isSavingVoice ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Voice
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent Content - Gated for Pro+ */}
          {hasContextAccess ? (
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
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Agent Knowledge & Instructions
                </CardTitle>
                <CardDescription>
                  Provide details about your business, services, pricing, and how the agent should handle calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <Crown className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <h3 className="font-medium mb-1">Define Custom Context</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Train your AI agent with custom business knowledge, pricing information, and call handling instructions. Available on Pro plans and above.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/dashboard/subscriptions')}>
                    Upgrade to Pro
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
