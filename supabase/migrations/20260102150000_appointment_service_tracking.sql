-- Migration: Add service tracking to appointments
-- Purpose: Track which service was booked and capture price at booking time for gross production reporting

ALTER TABLE public.appointments
ADD COLUMN service_id uuid REFERENCES public.services(id),
ADD COLUMN service_price_cents integer;

-- Add index for revenue aggregation queries
CREATE INDEX idx_appointments_service_id ON public.appointments(service_id);

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.service_id IS 'Reference to the service booked';
COMMENT ON COLUMN public.appointments.service_price_cents IS 'Price in cents at time of booking (snapshot for revenue tracking)';
