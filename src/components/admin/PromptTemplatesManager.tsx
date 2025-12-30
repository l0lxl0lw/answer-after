import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const PLACEHOLDER_INFO = [
  { placeholder: '{{orgName}}', description: 'Organization name', example: 'ABC Plumbing' },
  { placeholder: '{{businessHoursStart}}', description: 'Business opening time', example: '8:00 AM' },
  { placeholder: '{{businessHoursEnd}}', description: 'Business closing time', example: '5:00 PM' },
];

const TEMPLATE_INFO: Record<string, { title: string; purpose: string }> = {
  agent_base_prompt: {
    title: 'Base System Prompt',
    purpose: 'The main instructions that define how the AI agent behaves. This is the core personality and behavior of your receptionist.',
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
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

  const handleTemplateChange = (id: string, value: string) => {
    setEditedTemplates((prev) => ({ ...prev, [id]: value }));
  };

  const hasChanges = (template: PromptTemplate) => {
    return editedTemplates[template.id] !== undefined &&
           editedTemplates[template.id] !== template.template;
  };

  const handleSave = async (template: PromptTemplate) => {
    const newTemplate = editedTemplates[template.id];
    if (!newTemplate || newTemplate === template.template) return;

    try {
      setSaving(template.id);
      const { data, error } = await supabase.functions.invoke('admin-prompt-templates', {
        body: {
          id: template.id,
          template: newTemplate,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to update template');
      }

      // Update local state
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
  };

  const getPreview = (template: string) => {
    return template
      .replace(/\{\{orgName\}\}/g, 'ABC Plumbing')
      .replace(/\{\{businessHoursStart\}\}/g, '8:00 AM')
      .replace(/\{\{businessHoursEnd\}\}/g, '5:00 PM');
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <CardTitle>Prompt Templates</CardTitle>
          </div>
          <CardDescription>
            Edit the system-wide AI agent prompt templates. Changes affect all new agent updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 mb-2">Available Placeholders</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {PLACEHOLDER_INFO.map((p) => (
                    <div key={p.placeholder} className="bg-white rounded px-3 py-2 border border-amber-200">
                      <code className="text-xs font-mono text-amber-700">{p.placeholder}</code>
                      <p className="text-xs text-slate-600 mt-1">{p.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Cards */}
      {templates.map((template) => {
        const info = TEMPLATE_INFO[template.name] || { title: template.name, purpose: '' };
        const currentValue = editedTemplates[template.id] ?? template.template;
        const changed = hasChanges(template);

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
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="edit" className="gap-2">
                    <Code2 className="h-4 w-4" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit">
                  <Textarea
                    value={currentValue}
                    onChange={(e) => handleTemplateChange(template.id, e.target.value)}
                    className="font-mono text-sm min-h-[200px] resize-y"
                    placeholder="Enter template..."
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Last updated: {new Date(template.updated_at).toLocaleString()}
                  </p>
                </TabsContent>

                <TabsContent value="preview">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap min-h-[200px]">
                    {getPreview(currentValue)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Preview with sample values: orgName="ABC Plumbing", businessHoursStart="8:00 AM", businessHoursEnd="5:00 PM"
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      })}

      {templates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12 text-slate-500">
            <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No prompt templates found in the database.</p>
            <p className="text-sm mt-2">Templates will be created when the system initializes.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PromptTemplatesManager;
