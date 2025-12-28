-- Fix 1: Profiles - only self can view (not org-wide)
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Fix 2: Calls - only owner/admin can view
DROP POLICY IF EXISTS "Users can view calls in their organization" ON public.calls;
CREATE POLICY "Owners/admins can view calls in their organization" 
ON public.calls 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 3: Call transcripts - only owner/admin can view
DROP POLICY IF EXISTS "Users can view transcripts for their org calls" ON public.call_transcripts;
CREATE POLICY "Owners/admins can view transcripts for their org calls" 
ON public.call_transcripts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM calls 
    WHERE calls.id = call_transcripts.call_id 
    AND calls.organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Fix 4: Call events - only owner/admin can view
DROP POLICY IF EXISTS "Users can view call events for their org calls" ON public.call_events;
CREATE POLICY "Owners/admins can view call events for their org calls" 
ON public.call_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM calls 
    WHERE calls.id = call_events.call_id 
    AND calls.organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Fix 5: Appointments - only owner/admin can view/manage
DROP POLICY IF EXISTS "Users can view appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Users can update appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete appointments in their organization" ON public.appointments;

CREATE POLICY "Owners/admins can view appointments in their organization" 
ON public.appointments 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can insert appointments in their organization" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can update appointments in their organization" 
ON public.appointments 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can delete appointments in their organization" 
ON public.appointments 
FOR DELETE 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 6: Google Calendar connections - only owner/admin can manage
DROP POLICY IF EXISTS "Users can view their organization's calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can insert their organization's calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can update their organization's calendar connection" ON public.google_calendar_connections;
DROP POLICY IF EXISTS "Users can delete their organization's calendar connection" ON public.google_calendar_connections;

CREATE POLICY "Owners/admins can view calendar connection" 
ON public.google_calendar_connections 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can insert calendar connection" 
ON public.google_calendar_connections 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can update calendar connection" 
ON public.google_calendar_connections 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners/admins can delete calendar connection" 
ON public.google_calendar_connections 
FOR DELETE 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 7: Subscriptions - only owner/admin can view (contains Stripe IDs)
DROP POLICY IF EXISTS "Users can view their organization subscription" ON public.subscriptions;
CREATE POLICY "Owners/admins can view organization subscription" 
ON public.subscriptions 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 8: Organization agents - only owner/admin can view (contains ElevenLabs agent IDs)
DROP POLICY IF EXISTS "Users can view their organization agent" ON public.organization_agents;
CREATE POLICY "Owners/admins can view organization agent" 
ON public.organization_agents 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 9: Appointment reminders - only owner/admin can view  
DROP POLICY IF EXISTS "Users can view reminders in their organization" ON public.appointment_reminders;
CREATE POLICY "Owners/admins can view reminders in their organization" 
ON public.appointment_reminders 
FOR SELECT 
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Fix 10: Subscription tiers - require authentication (not public)
DROP POLICY IF EXISTS "Anyone can view active subscription tiers" ON public.subscription_tiers;
CREATE POLICY "Authenticated users can view active subscription tiers" 
ON public.subscription_tiers 
FOR SELECT 
TO authenticated
USING (is_active = true);