import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Code2, ArrowRight, Sparkles, MessageSquare, FileText, Layers } from 'lucide-react';

const PromptTransformationExplainer = () => {
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600" />
            <CardTitle>Prompt Transformation System</CardTitle>
          </div>
          <CardDescription>
            How customer input is transformed into AI agent prompts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            The system combines multiple data sources to create a customized AI agent prompt for each organization.
            This ensures the agent has the right context, tone, and capabilities for each business.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-blue-50/50">
              <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Greeting</h4>
                <p className="text-xs text-slate-600">Custom first message when call starts</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-purple-50/50">
              <FileText className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Context</h4>
                <p className="text-xs text-slate-600">Business-specific information & instructions</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-green-50/50">
              <Layers className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Templates</h4>
                <p className="text-xs text-slate-600">System-wide prompt templates from DB</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Flow & Transformation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Step 1: Input Sources */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-50">Step 1</Badge>
                <h3 className="font-semibold">Input Sources</h3>
              </div>

              <div className="ml-6 space-y-3">
                <div className="border-l-2 border-indigo-200 pl-4 py-2">
                  <div className="font-medium text-sm mb-1">organization_agents.context (JSON)</div>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`{
  "greeting": "Hi! Thanks for calling ABC Plumbing. This is Sarah, how can I help you?",
  "content": "We specialize in emergency plumbing repairs, drain cleaning, and water heater installation. We offer 24/7 emergency service..."
}`}
                  </pre>
                </div>

                <div className="border-l-2 border-purple-200 pl-4 py-2">
                  <div className="font-medium text-sm mb-1">organizations table</div>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`{
  "name": "ABC Plumbing",
  "business_hours_start": "8:00 AM",
  "business_hours_end": "6:00 PM"
}`}
                  </pre>
                </div>

                <div className="border-l-2 border-green-200 pl-4 py-2">
                  <div className="font-medium text-sm mb-1">prompt_templates table</div>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`{
  "agent_base_prompt": "You are a friendly AI receptionist for {{orgName}}...",
  "agent_first_message": "Hello! Thanks for calling {{orgName}}. How can I help you today?",
  "agent_context_prefix": "ADDITIONAL BUSINESS CONTEXT:"
}`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-slate-400" />
            </div>

            {/* Step 2: Variable Replacement */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-50">Step 2</Badge>
                <h3 className="font-semibold">Variable Replacement</h3>
              </div>

              <div className="ml-6 border-l-2 border-orange-200 pl-4 py-2">
                <div className="font-medium text-sm mb-2">Placeholder variables are replaced:</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <code className="bg-amber-100 px-2 py-0.5 rounded">{`{{orgName}}`}</code>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">ABC Plumbing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-amber-100 px-2 py-0.5 rounded">{`{{businessHoursStart}}`}</code>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">8:00 AM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-amber-100 px-2 py-0.5 rounded">{`{{businessHoursEnd}}`}</code>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">6:00 PM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-slate-400" />
            </div>

            {/* Step 3: Prompt Assembly */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-50">Step 3</Badge>
                <h3 className="font-semibold">Prompt Assembly</h3>
              </div>

              <div className="ml-6 space-y-3">
                <div className="border-l-2 border-blue-200 pl-4 py-2">
                  <div className="font-medium text-sm mb-1 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    First Message (Greeting)
                  </div>
                  <div className="text-xs bg-blue-50 p-3 rounded border border-blue-200">
                    Priority:
                    <ol className="list-decimal ml-5 mt-1 space-y-1">
                      <li>Use custom <code className="bg-blue-100 px-1 rounded">greeting</code> from context if provided</li>
                      <li>Otherwise use <code className="bg-blue-100 px-1 rounded">agent_first_message</code> template with variables replaced</li>
                    </ol>
                    <Separator className="my-2" />
                    <div className="font-medium mt-2">Result:</div>
                    <div className="italic mt-1 text-slate-700">
                      "Hi! Thanks for calling ABC Plumbing. This is Sarah, how can I help you?"
                    </div>
                  </div>
                </div>

                <div className="border-l-2 border-purple-200 pl-4 py-2">
                  <div className="font-medium text-sm mb-1 flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    System Prompt
                  </div>
                  <div className="text-xs bg-purple-50 p-3 rounded border border-purple-200">
                    Assembly logic:
                    <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto">
{`fullPrompt = replacePlaceholders(agent_base_prompt)

if (context.content exists and not empty) {
  fullPrompt += "\\n\\n" + agent_context_prefix + "\\n" + context.content
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="h-6 w-6 text-slate-400" />
            </div>

            {/* Step 4: Final Output */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Output</Badge>
                <h3 className="font-semibold">Final Agent Configuration</h3>
              </div>

              <div className="ml-6 border-l-2 border-green-300 pl-4 py-2">
                <div className="font-medium text-sm mb-2">Sent to ElevenLabs API:</div>
                <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto">
{`{
  "conversation_config": {
    "agent": {
      "first_message": "Hi! Thanks for calling ABC Plumbing. This is Sarah, how can I help you?",
      "prompt": {
        "prompt": "You are a friendly AI receptionist for ABC Plumbing, a professional service company.

Your responsibilities:
1. Greet callers warmly
2. Ask how you can help them today
3. Gather information about their issue (what's wrong, urgency level)
4. Collect their contact information (name, phone, address)
5. Help schedule appointments if needed
6. Handle emergencies by noting them as urgent

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful.

Business hours: 8:00 AM to 6:00 PM

ADDITIONAL BUSINESS CONTEXT:
We specialize in emergency plumbing repairs, drain cleaning, and water heater installation.
We offer 24/7 emergency service..."
      },
      "language": "en",
      "llm": {
        "model": "gemini-2.5-flash"
      },
      "tts": {
        "voice_id": "veda_sky"
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Implementation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="font-medium text-sm mb-2">Primary Function:</div>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded border">
                supabase/functions/elevenlabs-agent/index.ts:403-488
              </code>
              <div className="mt-2 text-xs text-slate-600">
                <code className="bg-slate-100 px-1 rounded">buildAgentPrompt()</code> - Main transformation logic
              </div>
            </div>

            <Separator />

            <div>
              <div className="font-medium text-sm mb-2">Key Features:</div>
              <ul className="text-sm space-y-2 ml-4 list-disc">
                <li>Templates are fetched from <code className="bg-slate-100 px-1 rounded text-xs">prompt_templates</code> table</li>
                <li>Falls back to hardcoded defaults if DB templates unavailable</li>
                <li>Context is stored as JSON string with <code className="bg-slate-100 px-1 rounded text-xs">greeting</code> and <code className="bg-slate-100 px-1 rounded text-xs">content</code> fields</li>
                <li>Supports 3 placeholder variables: orgName, businessHoursStart, businessHoursEnd</li>
                <li>Custom greeting always takes priority over template</li>
              </ul>
            </div>

            <Separator />

            <div>
              <div className="font-medium text-sm mb-2">Future Enhancements:</div>
              <ul className="text-sm space-y-2 ml-4 list-disc text-slate-600">
                <li>Services could be automatically included in the context</li>
                <li>Emergency keywords from <code className="bg-slate-100 px-1 rounded text-xs">organizations.emergency_keywords</code> could be injected</li>
                <li>More template variables (timezone, business address, etc.)</li>
                <li>Per-agent model selection (currently hardcoded to gemini-2.5-flash)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PromptTransformationExplainer;
