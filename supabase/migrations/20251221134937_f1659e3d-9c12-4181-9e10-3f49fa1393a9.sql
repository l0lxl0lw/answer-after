-- Create table for prompt templates
CREATE TABLE public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active templates
CREATE POLICY "Authenticated users can view active templates"
ON public.prompt_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only service role can manage templates (for edge functions)
CREATE POLICY "Service role can manage templates"
ON public.prompt_templates
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_prompt_templates_updated_at
BEFORE UPDATE ON public.prompt_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the default prompt templates
INSERT INTO public.prompt_templates (name, description, template) VALUES
(
  'agent_base_prompt',
  'The main system prompt for the AI receptionist agent. Supports placeholders: {{orgName}}, {{businessHoursStart}}, {{businessHoursEnd}}',
  'You are a friendly AI receptionist for {{orgName}}, a professional service company.

Your responsibilities:
1. Greet callers warmly
2. Ask how you can help them today
3. Gather information about their issue (what''s wrong, urgency level)
4. Collect their contact information (name, phone, address)
5. Help schedule appointments if needed
6. Handle emergencies by noting them as urgent

Keep your responses SHORT and conversational - this is a phone call. 2-3 sentences max.
Be warm, professional, and helpful.

If the caller describes an emergency (gas leak, flooding, no heat in freezing weather, no cooling in extreme heat), acknowledge the urgency and assure them help is on the way.

Business hours: {{businessHoursStart}} to {{businessHoursEnd}}

When you have gathered enough information (name, phone, address, issue description), summarize the appointment details and confirm with the caller.'
),
(
  'agent_first_message',
  'The default greeting message when no custom greeting is set. Supports placeholders: {{orgName}}',
  'Hello! Thanks for calling {{orgName}}. How can I help you today?'
),
(
  'agent_context_prefix',
  'Text added before custom business context. No placeholders.',
  'ADDITIONAL BUSINESS CONTEXT:'
);