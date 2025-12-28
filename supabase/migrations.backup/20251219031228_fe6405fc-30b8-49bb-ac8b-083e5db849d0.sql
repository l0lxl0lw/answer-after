-- Create organization_agents table for ElevenLabs agent mapping
CREATE TABLE public.organization_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  elevenlabs_agent_id text,
  context text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_agents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their organization agent"
ON public.organization_agents
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners can update their organization agent"
ON public.organization_agents
FOR UPDATE
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'owner'));

-- Allow service role to insert/update (for edge functions)
CREATE POLICY "Service role can manage organization agents"
ON public.organization_agents
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_organization_agents_updated_at
BEFORE UPDATE ON public.organization_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create organization_agent record for existing organizations
INSERT INTO public.organization_agents (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;