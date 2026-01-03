-- Remove Escalation Functionality
-- Removes escalation_contacts table and related columns

-- ============================================
-- STEP 1: DROP RLS POLICIES ON ESCALATION_CONTACTS
-- ============================================

DROP POLICY IF EXISTS "Users can view escalation contacts in their institution" ON public.escalation_contacts;
DROP POLICY IF EXISTS "Users can view escalation contacts in their account" ON public.escalation_contacts;
DROP POLICY IF EXISTS "Owners and admins can manage escalation contacts" ON public.escalation_contacts;
DROP POLICY IF EXISTS "Service role full access to escalation contacts" ON public.escalation_contacts;

-- ============================================
-- STEP 2: DROP TRIGGERS ON ESCALATION_CONTACTS
-- ============================================

DROP TRIGGER IF EXISTS update_escalation_contacts_updated_at ON public.escalation_contacts;

-- ============================================
-- STEP 3: DROP INDEXES ON ESCALATION_CONTACTS
-- ============================================

DROP INDEX IF EXISTS idx_escalation_contacts_institution;
DROP INDEX IF EXISTS idx_escalation_contacts_active_priority;
DROP INDEX IF EXISTS idx_escalation_contacts_account;
DROP INDEX IF EXISTS idx_escalation_contacts_institution_phone;

-- ============================================
-- STEP 4: DROP FK CONSTRAINT FROM CALLS TABLE
-- ============================================

ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_transferred_to_contact_id_fkey;

-- ============================================
-- STEP 5: DROP COLUMNS FROM CALLS TABLE
-- ============================================

ALTER TABLE public.calls DROP COLUMN IF EXISTS was_transferred;
ALTER TABLE public.calls DROP COLUMN IF EXISTS transferred_to_phone;
ALTER TABLE public.calls DROP COLUMN IF EXISTS transferred_to_contact_id;
ALTER TABLE public.calls DROP COLUMN IF EXISTS trigger_type;

-- ============================================
-- STEP 6: DROP ESCALATION_CONTACTS TABLE
-- ============================================

DROP TABLE IF EXISTS public.escalation_contacts;

-- ============================================
-- STEP 7: DROP ESCALATION_ROLE ENUM
-- ============================================

DROP TYPE IF EXISTS public.escalation_role;
