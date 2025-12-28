-- Create table to store Google Calendar connections per organization
CREATE TABLE public.google_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    selected_calendars TEXT[] DEFAULT '{}',
    connected_email TEXT,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create policies - only org members can view/manage their calendar connection
CREATE POLICY "Users can view their organization's calendar connection"
ON public.google_calendar_connections
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert their organization's calendar connection"
ON public.google_calendar_connections
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update their organization's calendar connection"
ON public.google_calendar_connections
FOR UPDATE
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete their organization's calendar connection"
ON public.google_calendar_connections
FOR DELETE
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_google_calendar_connections_updated_at
BEFORE UPDATE ON public.google_calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();