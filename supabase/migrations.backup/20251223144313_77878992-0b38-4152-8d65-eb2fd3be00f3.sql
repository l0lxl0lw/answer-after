-- Create services table for the service catalog
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  base_price_cents integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  category text NOT NULL DEFAULT 'routine',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view services in their organization"
ON public.services FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners/admins can insert services"
ON public.services FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Owners/admins can update services"
ON public.services FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Owners/admins can delete services"
ON public.services FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

-- Trigger for updated_at
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();