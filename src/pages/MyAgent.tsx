import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, Save, Loader2, MessageCircle, FileText, Crown, Upload, Trash2, File } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useNavigate, Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { KnowledgeBaseDocument } from '@/types/database';

const MAX_GREETING_WORDS = 100;
const MAX_CONTENT_WORDS = 4000;
const MAX_KB_DOCUMENTS = 3;
const MAX_FILE_SIZE_MB = 20;

export default function MyAgent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customGreeting, setCustomGreeting] = useState('');
  const [agentContent, setAgentContent] = useState('');
  const [hidePricesFromCustomers, setHidePricesFromCustomers] = useState(false);

  const [isSavingGreeting, setIsSavingGreeting] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [hasCustomAgentAccess, setHasCustomAgentAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check tier for feature access
  const { data: tierData } = useQuery({
    queryKey: ['subscription-tier-agent', subscription?.plan],
    queryFn: async () => {
      if (!subscription?.plan) return null;
      const { data } = await supabase
        .from('subscription_tiers')
        .select('has_custom_agent, has_outbound_reminders, has_custom_ai_training')
        .eq('plan_id', subscription.plan)
        .single();
      return data;
    },
    enabled: !!subscription?.plan,
  });

  // Context editing requires Pro+ (has_outbound_reminders is true for Pro+)
  const hasContextAccess = tierData?.has_outbound_reminders === true;
  // Knowledge base requires Pro+ (has_custom_ai_training is true for Pro+)
  const hasKnowledgeBaseAccess = tierData?.has_custom_ai_training === true;

  // Fetch knowledge base documents
  const { data: kbDocuments = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['knowledge-base-documents', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];
      const { data } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('account_id', user.account_id)
        .order('created_at', { ascending: false });
      return (data || []) as KnowledgeBaseDocument[];
    },
    enabled: !!user?.account_id && hasKnowledgeBaseAccess,
  });

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
      if (!user?.account_id) return;
      
      const { data, error } = await supabase
        .from('account_agents')
        .select('context')
        .eq('account_id', user.account_id)
        .maybeSingle();
      
      if (!error && data) {
        if (data.context) {
          try {
            const parsed = JSON.parse(data.context);
            setCustomGreeting(parsed.greeting || '');
            setAgentContent(parsed.content || '');
            setHidePricesFromCustomers(parsed.hidePricesFromCustomers ?? false);
          } catch {
            setAgentContent(data.context);
          }
        }
      }
    };
    
    fetchAgentData();
  }, [user?.account_id]);

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const saveAgentData = async (greeting: string, content: string, hidePrices?: boolean) => {
    if (!user?.account_id) return;

    const contextData = JSON.stringify({
      greeting,
      content,
      hidePricesFromCustomers: hidePrices ?? hidePricesFromCustomers
    });

    const { data: existingAgent } = await supabase
      .from('account_agents')
      .select('id, elevenlabs_agent_id')
      .eq('account_id', user.account_id)
      .maybeSingle();

    if (existingAgent) {
      const { error } = await supabase
        .from('account_agents')
        .update({ context: contextData })
        .eq('account_id', user.account_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('account_agents')
        .insert({ account_id: user.account_id, context: contextData });
      if (error) throw error;
    }

    return existingAgent;
  };

  const updateElevenLabsAgent = async (hidePrices?: boolean) => {
    if (!user?.account_id) return;

    const { data: existingAgent } = await supabase
      .from('account_agents')
      .select('elevenlabs_agent_id')
      .eq('account_id', user.account_id)
      .maybeSingle();

    if (existingAgent?.elevenlabs_agent_id) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.functions.invoke('elevenlabs-agent', {
          body: {
            action: 'update-agent',
            accountId: user.account_id,
            context: JSON.stringify({
              greeting: customGreeting,
              content: agentContent,
              hidePricesFromCustomers: hidePrices ?? hidePricesFromCustomers
            }),
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
      }
    }
  };

  const handleSaveGreeting = async () => {
    if (!user?.account_id) return;
    
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
              accountId: user.account_id
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
    if (!user?.account_id) return;
    
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

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`,
        variant: 'destructive',
      });
      return;
    }

    // Check document limit
    if (kbDocuments.length >= MAX_KB_DOCUMENTS) {
      toast({
        title: 'Document limit reached',
        description: `You can upload up to ${MAX_KB_DOCUMENTS} documents. Please delete an existing document first.`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-upload-knowledge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      toast({
        title: 'Document uploaded',
        description: `${file.name} has been added to your knowledge base.`,
      });

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-documents'] });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeletingDocumentId(documentId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.functions.invoke('agent-delete-knowledge', {
        body: { documentId },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Document deleted',
        description: 'The document has been removed from your knowledge base.',
      });

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['knowledge-base-documents'] });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete document.',
        variant: 'destructive',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            <h1 className="text-2xl font-bold text-foreground">Voice & Behavior</h1>
            <p className="text-muted-foreground mt-1">Customize how your AI agent engages leads</p>
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
          <h1 className="text-2xl font-bold text-foreground">Voice & Behavior</h1>
          <p className="text-muted-foreground mt-1">Customize how your AI agent engages and converts leads</p>
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
                placeholder="Example: Hello! Thank you for calling Smile Dental Care. How can I help you today?"
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

          {/* Agent Content - Gated for Pro+ */}
          {hasContextAccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Agent Knowledge & Instructions
                </CardTitle>
                <CardDescription>
                  Provide additional business details and call handling instructions. Your agent already uses services defined in{' '}
                  <Link to="/dashboard/services" className="text-primary hover:underline">
                    My Services
                  </Link>{' '}
                  to suggest appropriate options to customers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="min-h-[300px] resize-y"
                  placeholder="Example:
About the practice:
We are Smile Dental Care, serving the Dallas area since 1985.

How to handle calls:
- Always be friendly and professional
- Ask for caller's name and phone number
- For emergencies, offer same-day appointments

Additional notes:
- We offer a new patient special
- Saturday appointments available"
                  value={agentContent}
                  onChange={(e) => setAgentContent(e.target.value)}
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hidePrices"
                    checked={hidePricesFromCustomers}
                    onCheckedChange={(checked) => setHidePricesFromCustomers(checked === true)}
                  />
                  <Label htmlFor="hidePrices" className="text-sm font-normal cursor-pointer">
                    Don't share pricing with customers (agent will ask them to inquire for quotes)
                  </Label>
                </div>
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
                  Provide additional business details and call handling instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <Crown className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <h3 className="font-medium mb-1">Define Custom Context</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Train your AI agent with custom business knowledge and call handling instructions. Control whether to share pricing with customers. Available on Pro plans and above.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/dashboard/subscriptions')}>
                    Upgrade to Pro
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Knowledge Base - Gated for Pro+ */}
          {hasKnowledgeBaseAccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <File className="h-5 w-5" />
                  Knowledge Base
                </CardTitle>
                <CardDescription>
                  Upload PDFs to give your agent detailed reference material. Your agent will use these documents to provide more accurate and relevant information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Document list */}
                {isLoadingDocs ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : kbDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {kbDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size_bytes)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={deletingDocumentId === doc.id}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingDocumentId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded yet</p>
                  </div>
                )}

                {/* Upload button */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    {kbDocuments.length}/{MAX_KB_DOCUMENTS} documents
                  </span>
                  {kbDocuments.length < MAX_KB_DOCUMENTS && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleUploadDocument}
                        className="hidden"
                        id="kb-file-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingDocument}
                      >
                        {isUploadingDocument ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload PDF
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <File className="h-5 w-5" />
                  Knowledge Base
                </CardTitle>
                <CardDescription>
                  Upload PDFs to give your agent detailed reference material
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <Crown className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <h3 className="font-medium mb-1">Upload Reference Documents</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Give your AI agent access to your PDFs, catalogs, or documentation for more accurate responses. Available on Pro plans and above.
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
