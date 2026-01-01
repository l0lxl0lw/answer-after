-- Migration: Create unified contacts table for leads and customers
-- Replaces Google Contacts integration with local storage

-- Contact status enum
DO $$ BEGIN
  CREATE TYPE public.contact_status AS ENUM ('lead', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Contact source enum
DO $$ BEGIN
  CREATE TYPE public.contact_source AS ENUM ('inbound_call', 'manual', 'import');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  status contact_status NOT NULL DEFAULT 'lead',
  source contact_source NOT NULL DEFAULT 'inbound_call',
  -- Lead-specific fields
  interest_level interest_level,
  lead_status lead_status DEFAULT 'new',
  lead_notes TEXT,
  lead_updated_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one phone per organization
  UNIQUE(organization_id, phone)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contacts_org_status ON public.contacts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON public.contacts(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_interest ON public.contacts(organization_id, interest_level) WHERE status = 'lead';

-- Add contact_id to calls table to link calls to contacts
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calls_contact ON public.calls(contact_id);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view contacts in their organization"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert contacts in their organization"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update contacts in their organization"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete contacts in their organization"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Comments
COMMENT ON TABLE public.contacts IS 'Unified contacts table for leads and customers';
COMMENT ON COLUMN public.contacts.status IS 'lead = has called but not booked, customer = has booked or manually added';
COMMENT ON COLUMN public.contacts.source IS 'How the contact was created';
COMMENT ON COLUMN public.contacts.interest_level IS 'AI-detected interest level for leads';
COMMENT ON COLUMN public.contacts.lead_status IS 'Lead lifecycle status';
