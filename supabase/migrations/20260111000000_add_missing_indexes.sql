-- Add missing indexes for performance optimization
-- These indexes improve query performance for common access patterns

-- Index on calls.contact_id for contact → calls queries
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);

-- Composite index on contacts for phone lookups by institution
CREATE INDEX IF NOT EXISTS idx_contacts_institution_phone ON contacts(institution_id, phone);

-- Index on call_intakes.contact_id for linking intakes to contacts
CREATE INDEX IF NOT EXISTS idx_call_intakes_contact_id ON call_intakes(contact_id);

-- Index on escalation_contacts for rapid phone lookups during emergency transfers
CREATE INDEX IF NOT EXISTS idx_escalation_contacts_institution_phone ON escalation_contacts(institution_id, phone);
