import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Save,
  RotateCcw,
  Code2,
  Eye,
  Sparkles,
  Info,
  Plus,
  ChevronDown,
  Building2,
} from 'lucide-react';

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  name: string;
}

interface PlaceholderDefinition {
  key: string;
  placeholder: string;
  description: string;
  example: string;
  category: string;
}

interface PreviewResult {
  rendered: string;
  placeholderValues: Record<string, string>;
  organization: { id: string; name: string };
}

const TEMPLATE_INFO: Record<string, { title: string; purpose: string }> = {
  agent_base_prompt: {
    title: 'Base System Prompt',
    purpose: 'The main instructions that define how the AI agent behaves. This is the core personality and behavior of the AI agent.',
  },
  agent_first_message: {
    title: 'First Message / Greeting',
    purpose: 'The default greeting when a call starts. Used if the organization hasn\'t set a custom greeting.',
  },
  agent_context_prefix: {
    title: 'Context Section Header',
    purpose: 'The header text that introduces the business-specific context section in the prompt.',
  },
};

const PromptTemplatesManager = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [placeholderDefs, setPlaceholderDefs] = useState<PlaceholderDefinition[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<Record<string, PreviewResult>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', template: '', description: '' });
  const { toast } = useToast();

  // Fetch templates and placeholder definitions on mount
  useEffect(() => {
    fetchTemplates();
    fetchPlaceholders();
    fetchAccounts();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates', {
        method: 'GET',
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch templates');
      }

      setTemplates(data?.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaceholders = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates?action=placeholders', {
        method: 'GET',
      });

      if (error) {
        console.error('Error fetching placeholders:', error);
        return;
      }

      setPlaceholderDefs(data?.data || []);
    } catch (error) {
      console.error('Error fetching placeholders:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-accounts', {
        method: 'GET',
      });

      if (error) {
        console.error('Error fetching accounts:', error);
        return;
      }

      const accts = data?.data || [];
      setAccounts(accts);
      if (accts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accts[0].id);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  // Debounced preview fetching
  const fetchPreview = useCallback(async (templateId: string, templateContent: string) => {
    if (!selectedAccountId || !templateContent) return;

    setPreviewLoading((prev) => ({ ...prev, [templateId]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates', {
        body: {
          action: 'preview',
          template: templateContent,
          accountId: selectedAccountId,
        },
      });

      if (error) {
        console.error('Preview error:', error);
        return;
      }

      setPreviewData((prev) => ({ ...prev, [templateId]: data }));
    } catch (error) {
      console.error('Error fetching preview:', error);
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [templateId]: false }));
    }
  }, [selectedAccountId]);

  // Fetch preview when account changes
  useEffect(() => {
    if (selectedAccountId) {
      templates.forEach((template) => {
        const currentValue = editedTemplates[template.id] ?? template.template;
        fetchPreview(template.id, currentValue);
      });
    }
  }, [selectedAccountId, templates]);

  const handleTemplateChange = (id: string, value: string) => {
    setEditedTemplates((prev) => ({ ...prev, [id]: value }));
    // Debounce preview update
    const timeoutId = setTimeout(() => {
      fetchPreview(id, value);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const hasChanges = (template: PromptTemplate) => {
    return editedTemplates[template.id] !== undefined &&
           editedTemplates[template.id] !== template.template;
  };

  const handleSave = async (template: PromptTemplate) => {
    const newTemplateContent = editedTemplates[template.id];
    if (!newTemplateContent || newTemplateContent === template.template) return;

    try {
      setSaving(template.id);
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates', {
        body: {
          id: template.id,
          template: newTemplateContent,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to update template');
      }

      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? data.data : t))
      );
      setEditedTemplates((prev) => {
        const { [template.id]: _, ...rest } = prev;
        return rest;
      });

      toast({
        title: 'Saved',
        description: `Template "${template.name}" updated successfully`,
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (template: PromptTemplate) => {
    setEditedTemplates((prev) => {
      const { [template.id]: _, ...rest } = prev;
      return rest;
    });
    fetchPreview(template.id, template.template);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.template) {
      toast({
        title: 'Error',
        description: 'Name and template content are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreatingTemplate(true);
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates', {
        method: 'PUT',
        body: {
          name: newTemplate.name,
          template: newTemplate.template,
          description: newTemplate.description || null,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create template');
      }

      setTemplates((prev) => [...prev, data.data]);
      setNewTemplate({ name: '', template: '', description: '' });
      setCreateDialogOpen(false);

      toast({
        title: 'Created',
        description: `Template "${newTemplate.name}" created successfully`,
      });
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create template',
        variant: 'destructive',
      });
    } finally {
      setCreatingTemplate(false);
    }
  };

  // Group placeholders by category
  const placeholdersByCategory = useMemo(() => {
    const grouped: Record<string, PlaceholderDefinition[]> = {};
    placeholderDefs.forEach((p) => {
      if (!grouped[p.category]) {
        grouped[p.category] = [];
      }
      grouped[p.category].push(p);
    });
    return grouped;
  }, [placeholderDefs]);

  const truncateValue = (value: string, maxLength: number = 60) => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
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
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-600" />
              <CardTitle>Prompt Templates</CardTitle>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Add a new prompt template to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Template Name (snake_case)</Label>
                    <Input
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., agent_emergency_handler"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="What is this template used for?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Template Content</Label>
                    <Textarea
                      value={newTemplate.template}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, template: e.target.value }))}
                      className="font-mono min-h-[200px]"
                      placeholder="Enter template with {{placeholders}}..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTemplate} disabled={creatingTemplate}>
                    {creatingTemplate && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Edit the system-wide AI agent prompt templates. Changes affect all new agent updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Placeholders Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm w-full">
                <p className="font-medium text-amber-800 mb-3">Available Placeholders</p>
                {Object.entries(placeholdersByCategory).map(([category, placeholders]) => (
                  <div key={category} className="mb-3">
                    <p className="text-xs uppercase text-amber-600 font-semibold mb-2">{category}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {placeholders.map((p) => (
                        <div key={p.placeholder} className="bg-white rounded px-3 py-2 border border-amber-200">
                          <code className="text-xs font-mono text-amber-700">{p.placeholder}</code>
                          <p className="text-xs text-slate-600 mt-1">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Account Selector */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border">
            <Building2 className="h-5 w-5 text-slate-600" />
            <div className="flex-1">
              <Label className="text-sm font-medium">Preview with Account</Label>
              <p className="text-xs text-slate-500">Select an account to see how templates render with real data</p>
            </div>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Template Cards */}
      {templates.map((template) => {
        const info = TEMPLATE_INFO[template.name] || { title: template.name, purpose: '' };
        const currentValue = editedTemplates[template.id] ?? template.template;
        const changed = hasChanges(template);
        const preview = previewData[template.id];
        const isPreviewLoading = previewLoading[template.id];

        return (
          <Card key={template.id} className={changed ? 'ring-2 ring-indigo-500' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{info.title}</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {template.name}
                    </Badge>
                    {changed && (
                      <Badge className="bg-indigo-500">Unsaved</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    {info.purpose || template.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {changed && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReset(template)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(template)}
                        disabled={saving === template.id}
                      >
                        {saving === template.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Side-by-side layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Editor */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Code2 className="h-4 w-4" />
                    Template Editor
                  </Label>
                  <Textarea
                    value={currentValue}
                    onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                    className="font-mono text-sm min-h-[300px] resize-y"
                    placeholder="Enter template..."
                  />
                  <p className="text-xs text-slate-500">
                    Last updated: {new Date(template.updated_at).toLocaleString()}
                  </p>
                </div>

                {/* Right: Preview */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Eye className="h-4 w-4" />
                    Live Preview
                    {preview?.organization && (
                      <span className="text-xs text-slate-500 font-normal ml-2">
                        ({preview.organization.name})
                      </span>
                    )}
                  </Label>

                  {isPreviewLoading ? (
                    <div className="flex items-center justify-center h-[300px] bg-slate-100 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : preview?.rendered ? (
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap min-h-[300px] max-h-[400px] overflow-auto">
                      {preview.rendered}
                    </div>
                  ) : (
                    <div className="bg-slate-100 p-4 rounded-lg min-h-[300px] flex items-center justify-center text-slate-500">
                      {selectedAccountId ? 'Loading preview...' : 'Select an account to preview'}
                    </div>
                  )}

                  {/* Placeholder values breakdown */}
                  {preview?.placeholderValues && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                        <ChevronDown className="h-4 w-4" />
                        View placeholder values
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 text-xs bg-slate-50 p-3 rounded space-y-2 max-h-[200px] overflow-auto">
                          {Object.entries(preview.placeholderValues).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2">
                              <code className="font-mono text-indigo-600 whitespace-nowrap">{`{{${key}}}`}</code>
                              <span className="text-slate-400">=</span>
                              <span className="text-slate-700 break-all">
                                {value ? truncateValue(String(value)) : <em className="text-slate-400">(empty)</em>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12 text-slate-500">
            <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No prompt templates found in the database.</p>
            <p className="text-sm mt-2">Click "Create Template" to add one.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PromptTemplatesManager;
