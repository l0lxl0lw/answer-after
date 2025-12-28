-- Remove technician_id column from appointments table
ALTER TABLE public.appointments DROP COLUMN IF EXISTS technician_id;

-- Drop on_call_schedules table (has foreign key to technicians)
DROP TABLE IF EXISTS public.on_call_schedules;

-- Drop technicians table
DROP TABLE IF EXISTS public.technicians;