import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Database,
  Code,
  RefreshCw,
  Save,
  Trash2,
  Plus,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Bot,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const TABLES = [
  "organizations",
  "profiles",
  "subscriptions",
  "subscription_tiers",
  "appointment_reminders",
  "phone_numbers",
  "calls",
  "call_events",
  "call_transcripts",
  "appointments",
  "technicians",
  "on_call_schedules",
  "organization_agents",
  "user_roles",
  "prompt_templates",
];

// Placeholder info for prompt templates
const PLACEHOLDER_INFO = `
Available Placeholders:
- {{orgName}} - Organization name
- {{businessHoursStart}} - Business hours start time
- {{businessHoursEnd}} - Business hours end time
`;

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedTable, setSelectedTable] = useState(TABLES[0]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Check if user is admin
  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
        return;
      }

      const roles = data?.map((r) => r.role) || [];
      const hasAdminAccess = roles.includes("admin") || roles.includes("owner");
      setIsAdmin(hasAdminAccess);
    }

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  // Fetch table data
  useEffect(() => {
    fetchTableData();
  }, [selectedTable, page]);

  async function fetchTableData() {
    if (!selectedTable) return;
    setIsLoading(true);

    try {
      // Get count first
      const { count } = await supabase
        .from(selectedTable as any)
        .select("*", { count: "exact", head: true });

      setTotalCount(count || 0);

      // Fetch data with pagination
      const { data, error } = await supabase
        .from(selectedTable as any)
        .select("*")
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching table data:", error);
        toast.error(`Error fetching ${selectedTable}: ${error.message}`);
        setTableData([]);
        setTableColumns([]);
        return;
      }

      setTableData(data || []);
      if (data && data.length > 0) {
        setTableColumns(Object.keys(data[0]));
      } else {
        setTableColumns([]);
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to fetch table data");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveRow(row: any) {
    try {
      const { error } = await supabase
        .from(selectedTable as any)
        .update(row)
        .eq("id", row.id);

      if (error) {
        toast.error(`Error saving: ${error.message}`);
        return;
      }

      toast.success("Row saved successfully");
      setEditingRow(null);
      fetchTableData();
    } catch (err) {
      toast.error("Failed to save row");
    }
  }

  async function handleDeleteRow(id: string) {
    if (!confirm("Are you sure you want to delete this row?")) return;

    try {
      const { error } = await supabase
        .from(selectedTable as any)
        .delete()
        .eq("id", id);

      if (error) {
        toast.error(`Error deleting: ${error.message}`);
        return;
      }

      toast.success("Row deleted successfully");
      fetchTableData();
    } catch (err) {
      toast.error("Failed to delete row");
    }
  }

  // Loading state
  if (authLoading || isAdmin === null) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Not authorized
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have admin privileges to access this page.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">
              Manage database tables and view system configuration
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database Tables
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Prompt Logic
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-6 space-y-4">
            {/* Table Selector */}
            <div className="flex items-center gap-4">
              <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setPage(1); }}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchTableData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>

              <Badge variant="secondary">
                {totalCount} rows
              </Badge>
            </div>

            {/* Table View */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{selectedTable}</CardTitle>
                <CardDescription>
                  View and edit data in the {selectedTable} table
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : tableData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No data found in this table</p>
                  </div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="min-w-max">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Actions</TableHead>
                            {tableColumns.slice(0, 6).map((col) => (
                              <TableHead key={col} className="min-w-32">
                                {col}
                              </TableHead>
                            ))}
                            {tableColumns.length > 6 && (
                              <TableHead>+{tableColumns.length - 6} more</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditingRow(row)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteRow(row.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                              {tableColumns.slice(0, 6).map((col) => (
                                <TableCell key={col} className="max-w-48 truncate">
                                  {typeof row[col] === "object"
                                    ? JSON.stringify(row[col])
                                    : String(row[col] ?? "")}
                                </TableCell>
                              ))}
                              {tableColumns.length > 6 && (
                                <TableCell className="text-muted-foreground">
                                  ...
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Row Modal */}
            {editingRow && (
              <Card className="fixed inset-4 md:inset-auto md:fixed md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[800px] md:max-h-[80vh] z-50 overflow-auto shadow-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Edit Row</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRow(null)}
                    >
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[60vh]">
                    <div className="space-y-4 pr-4">
                      {tableColumns.map((col) => (
                        <div key={col} className="space-y-1">
                          <label className="text-sm font-medium">{col}</label>
                          {typeof editingRow[col] === "object" ? (
                            <Textarea
                              value={JSON.stringify(editingRow[col], null, 2)}
                              onChange={(e) => {
                                try {
                                  setEditingRow({
                                    ...editingRow,
                                    [col]: JSON.parse(e.target.value),
                                  });
                                } catch {
                                  // Keep as string if invalid JSON
                                }
                              }}
                              className="font-mono text-xs"
                              rows={4}
                            />
                          ) : (
                            <Input
                              value={String(editingRow[col] ?? "")}
                              onChange={(e) =>
                                setEditingRow({
                                  ...editingRow,
                                  [col]: e.target.value,
                                })
                              }
                              disabled={col === "id"}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setEditingRow(null)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => handleSaveRow(editingRow)}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Backdrop for edit modal */}
            {editingRow && (
              <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                onClick={() => setEditingRow(null)}
              />
            )}
          </TabsContent>

          {/* Prompt Templates Tab */}
          <TabsContent value="prompts" className="mt-6 space-y-6">
            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  Prompt Templates
                </CardTitle>
                <CardDescription>
                  Edit the AI agent prompt templates. Changes are stored in the database and used when creating/updating agents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Flow Diagram */}
                  <div className="bg-muted/50 rounded-xl p-4">
                    <h4 className="font-medium mb-3 text-sm">Data Flow</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="py-1 px-2">
                        My Agent Page
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="py-1 px-2">
                        organization_agents.context
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="py-1 px-2">
                        prompt_templates (DB)
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="default" className="py-1 px-2">
                        ElevenLabs Agent
                      </Badge>
                    </div>
                  </div>

                  {/* Placeholder Info */}
                  <div className="bg-info/10 border border-info/20 rounded-lg p-4">
                    <h4 className="font-medium text-info text-sm mb-2">Available Placeholders</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <code className="bg-background px-2 py-1 rounded">{"{{orgName}}"}</code>
                      <code className="bg-background px-2 py-1 rounded">{"{{businessHoursStart}}"}</code>
                      <code className="bg-background px-2 py-1 rounded">{"{{businessHoursEnd}}"}</code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prompt Template Editor */}
            <PromptTemplateEditor />

            {/* Live Agent Data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Organization Agents</CardTitle>
                <CardDescription>
                  View current agent configurations and their context data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LiveAgentDataViewer />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai-settings" className="mt-6 space-y-6">
            <AISettingsEditor />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Available LLM models for ElevenLabs agents
const LLM_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Recommended - Best balance of speed and quality' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Faster and cheaper, slightly lower quality' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Highest quality, slower and more expensive' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI model - high quality' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'OpenAI model - faster and cheaper' },
];

// Component to edit AI settings
function AISettingsEditor() {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("organization_agents")
      .select(`
        *,
        organizations(name)
      `);

    if (!error && data) {
      setAgents(data);
      // Initialize selected models from context
      const models: Record<string, string> = {};
      data.forEach((agent) => {
        try {
          const parsed = JSON.parse(agent.context || '{}');
          models[agent.id] = parsed.llmModel || 'gemini-2.5-flash';
        } catch {
          models[agent.id] = 'gemini-2.5-flash';
        }
      });
      setSelectedModels(models);
    }
    setIsLoading(false);
  }

  async function handleSaveModel(agent: any) {
    setSavingAgentId(agent.id);
    
    try {
      // Parse existing context
      let contextObj: any = {};
      try {
        contextObj = JSON.parse(agent.context || '{}');
      } catch {
        contextObj = {};
      }
      
      // Update with new model
      contextObj.llmModel = selectedModels[agent.id];
      
      // Save to database
      const { error } = await supabase
        .from("organization_agents")
        .update({ 
          context: JSON.stringify(contextObj),
          updated_at: new Date().toISOString()
        })
        .eq("id", agent.id);

      if (error) {
        toast.error(`Failed to save: ${error.message}`);
        return;
      }

      // Update ElevenLabs agent
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.functions.invoke('elevenlabs-agent', {
          body: { 
            action: 'update-agent',
            organizationId: agent.organization_id,
            context: JSON.stringify(contextObj),
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
      }

      toast.success(`Model updated for ${agent.organizations?.name || 'agent'}`);
      fetchAgents();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setSavingAgentId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No agents configured yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            LLM Model Settings
          </CardTitle>
          <CardDescription>
            Configure which language model each organization's AI agent uses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-muted/50 border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">
                    {agent.organizations?.name || "Unknown Organization"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Agent ID: {agent.elevenlabs_agent_id || "Not created"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Select 
                  value={selectedModels[agent.id] || 'gemini-2.5-flash'} 
                  onValueChange={(value) => setSelectedModels(prev => ({ ...prev, [agent.id]: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  size="sm"
                  onClick={() => handleSaveModel(agent)}
                  disabled={savingAgentId === agent.id}
                >
                  {savingAgentId === agent.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="ml-2">Save</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Component to edit prompt templates
function PromptTemplateEditor() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .order("name");

    if (!error && data) {
      setTemplates(data);
      // Initialize edited templates
      const edited: Record<string, string> = {};
      data.forEach((t) => {
        edited[t.id] = t.template;
      });
      setEditedTemplates(edited);
    }
    setIsLoading(false);
  }

  async function handleSave(template: any) {
    setIsSaving(template.id);
    
    const { error } = await supabase
      .from("prompt_templates")
      .update({ 
        template: editedTemplates[template.id],
        updated_at: new Date().toISOString()
      })
      .eq("id", template.id);

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success(`Template "${template.name}" saved successfully`);
      fetchTemplates();
    }
    setIsSaving(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-mono">{template.name}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {template.description}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={template.is_active ? "default" : "secondary"}>
                  {template.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => handleSave(template)}
                  disabled={isSaving === template.id || editedTemplates[template.id] === template.template}
                >
                  {isSaving === template.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="ml-2">Save</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editedTemplates[template.id] || ""}
              onChange={(e) =>
                setEditedTemplates((prev) => ({
                  ...prev,
                  [template.id]: e.target.value,
                }))
              }
              className="font-mono text-xs min-h-[200px]"
              placeholder="Enter template content..."
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                Last updated: {new Date(template.updated_at).toLocaleString()}
              </span>
              {editedTemplates[template.id] !== template.template && (
                <Badge variant="outline" className="text-warning">
                  Unsaved changes
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Component to view live organization agent data
function LiveAgentDataViewer() {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      const { data, error } = await supabase
        .from("organization_agents")
        .select(`
          *,
          organizations(name)
        `);

      if (!error && data) {
        setAgents(data);
      }
      setIsLoading(false);
    }

    fetchAgents();
  }, []);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (agents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No agents configured</p>
    );
  }

  return (
    <div className="space-y-4">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="bg-muted/50 border rounded-lg p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {agent.organizations?.name || "Unknown Org"}
            </h4>
            <Badge variant="outline" className="font-mono text-xs">
              {agent.elevenlabs_agent_id || "No agent ID"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Organization ID: {agent.organization_id}
          </div>
          {agent.context && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Context:
              </p>
              <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32 border">
                {typeof agent.context === "string"
                  ? agent.context
                  : JSON.stringify(agent.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
