-- Create appointment reminders table
CREATE TABLE public.appointment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL CHECK (reminder_number >= 1 AND reminder_number <= 3),
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'call' CHECK (reminder_type IN ('call', 'sms')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  response TEXT CHECK (response IN ('confirmed', 'declined', 'reschedule_requested', 'no_answer', NULL)),
  twilio_call_sid TEXT,
  call_duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, reminder_number)
);

-- Enable RLS
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view reminders in their organization"
ON public.appointment_reminders
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners/admins can manage reminders"
ON public.appointment_reminders
FOR ALL
USING (
  organization_id = get_user_organization_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Service role can manage reminders"
ON public.appointment_reminders
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_appointment_reminders_updated_at
BEFORE UPDATE ON public.appointment_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_appointment_reminders_scheduled ON public.appointment_reminders(scheduled_time, status);
CREATE INDEX idx_appointment_reminders_appointment ON public.appointment_reminders(appointment_id);

-- Add has_outbound_reminders to subscription_tiers if not exists
ALTER TABLE public.subscription_tiers 
ADD COLUMN IF NOT EXISTS has_outbound_reminders BOOLEAN NOT NULL DEFAULT false;

-- Update Pro and Enterprise tiers to have outbound reminders
UPDATE public.subscription_tiers 
SET has_outbound_reminders = true 
WHERE plan_id IN ('pro', 'enterprise', 'test_internal');

-- Enable realtime for reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reminders;