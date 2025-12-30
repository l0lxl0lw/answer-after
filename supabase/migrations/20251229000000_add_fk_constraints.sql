-- ============================================
-- Add missing foreign key constraints
-- ============================================

-- appointment_reminders.appointment_id -> appointments(id)
ALTER TABLE public.appointment_reminders
  ADD CONSTRAINT fk_appointment_reminders_appointment
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE CASCADE;

-- user_roles.user_id -> profiles(id)
-- Note: profiles.id is linked to auth.users, so this maintains referential integrity
ALTER TABLE public.user_roles
  ADD CONSTRAINT fk_user_roles_user
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- verification_codes.user_id -> profiles(id) (nullable FK)
ALTER TABLE public.verification_codes
  ADD CONSTRAINT fk_verification_codes_user
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;
