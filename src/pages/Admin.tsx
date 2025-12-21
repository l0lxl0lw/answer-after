import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { toast } from "sonner";

const TABLES = [
  "organizations",
  "profiles",
  "subscriptions",
  "subscription_tiers",
  "phone_numbers",
  "calls",
  "call_events",
  "call_transcripts",
  "appointments",
  "technicians",
  "on_call_schedules",
  "organization_agents",
  "user_roles",
];

// The prompt building logic from elevenlabs-agent function
const PROMPT_LOGIC = `
// This is the prompt conversion logic from supabase/functions/elevenlabs-agent/index.ts

function buildAgentPrompt(orgData: any, context: string): { prompt: string; firstMessage: string } {
  let greeting = '';
  let content = '';
  
  // Try to parse structured context from My Agent page input
  // The My Agent page saves: { greeting: \\"...\\", content: \\"...\\" }
  try {
    const parsed = JSON.parse(context);
    greeting = parsed.greeting || '';  // Custom greeting message
    content = parsed.content || '';    // Business context/instructions
  } catch {
    content = context;  // If not JSON, treat entire input as content
  }

  // Default first message if no custom greeting provided
  const firstMessage = greeting || \`Hello! Thanks for calling \${orgData.name}. How can I help you today?\`;

  // Base system prompt for the AI agent
  const basePrompt = \`You are a friendly AI receptionist for \${orgData.name}, a professional service company.

Your responsibilities:
1. Greet callers warmly
2. Ask how you can help them today
3. Gather information about their issue (what's wrong, urgency level)
4. Collect their contact information (name, phone, address)
5. Help schedule appointments if needed
6. Handle emergencies by noting them as urgent

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful.

If the caller describes an emergency (gas leak, flooding, no heat in freezing weather, no cooling in extreme heat), acknowledge the urgency and assure them help is on the way.

Business hours: \${orgData.business_hours_start || '8:00 AM'} to \${orgData.business_hours_end || '5:00 PM'}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller.\`;

  // Append business context if provided
  let fullPrompt = basePrompt;
  if (content && content.trim()) {
    fullPrompt = \`\${basePrompt}

ADDITIONAL BUSINESS CONTEXT:
\${content}\`;
  }

  return { prompt: fullPrompt, firstMessage };
}

// This function is called when:
// 1. Creating a new agent (handleCreateAgent)
// 2. Updating an existing agent (handleUpdateAgent)

// The context parameter comes from:
// - organization_agents.context column in the database
// - Which is set from the My Agent page when user saves their greeting/content
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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tables" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database Tables
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Prompt Logic
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

          {/* Prompt Logic Tab */}
          <TabsContent value="prompts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  Agent Prompt Conversion Logic
                </CardTitle>
                <CardDescription>
                  This shows how user input from the "My Agent" page is transformed into the ElevenLabs agent prompt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Flow Diagram */}
                  <div className="bg-muted/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Data Flow</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Badge variant="outline" className="py-2 px-3">
                        My Agent Page Input
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="py-2 px-3">
                        organization_agents.context
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="py-2 px-3">
                        buildAgentPrompt()
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="default" className="py-2 px-3">
                        ElevenLabs Agent Config
                      </Badge>
                    </div>
                  </div>

                  {/* Context Structure */}
                  <div className="bg-muted/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Context JSON Structure</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      The My Agent page saves data in this format to the organization_agents.context column:
                    </p>
                    <pre className="bg-background border rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`{
  "greeting": "Hello! Thanks for calling ABC Plumbing...",
  "content": "We specialize in emergency repairs, drain cleaning..."
}`}
                    </pre>
                  </div>

                  {/* Code */}
                  <div className="bg-muted/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4">Source Code</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      From: supabase/functions/elevenlabs-agent/index.ts
                    </p>
                    <ScrollArea className="h-[500px]">
                      <pre className="bg-background border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap">
                        {PROMPT_LOGIC}
                      </pre>
                    </ScrollArea>
                  </div>

                  {/* Live Agent Data */}
                  <LiveAgentDataViewer />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
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

  return (
    <div className="bg-muted/50 rounded-xl p-6">
      <h3 className="font-semibold mb-4">Live Organization Agents</h3>
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents configured</p>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-background border rounded-lg p-4 space-y-2"
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
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-32">
                    {typeof agent.context === "string"
                      ? agent.context
                      : JSON.stringify(agent.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
