-- Outbound Campaigns Schema

-- Campaign status enum
DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status campaign_status DEFAULT 'draft',
  campaign_type text DEFAULT 'outbound', -- outbound, follow_up

  -- Configuration
  agent_prompt text,
  first_message text,
  max_attempts integer DEFAULT 3,
  retry_delay_hours integer DEFAULT 24,

  -- Schedule
  start_date timestamptz,
  end_date timestamptz,
  calling_hours_start time DEFAULT '09:00',
  calling_hours_end time DEFAULT '17:00',
  calling_days text[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  timezone text DEFAULT 'America/New_York',

  -- Stats (denormalized for performance)
  total_contacts integer DEFAULT 0,
  contacts_called integer DEFAULT 0,
  contacts_connected integer DEFAULT 0,
  contacts_completed integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Campaign contacts (many-to-many with status)
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  status text DEFAULT 'pending', -- pending, calling, connected, completed, failed, skipped
  attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  last_call_id uuid REFERENCES calls(id),
  outcome text, -- answered, no_answer, voicemail, busy, failed
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, contact_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON campaign_contacts(contact_id);

-- RLS policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Campaigns: users can only see campaigns for their account
CREATE POLICY "Users can view own account campaigns"
  ON campaigns FOR SELECT
  USING (account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert campaigns for own account"
  ON campaigns FOR INSERT
  WITH CHECK (account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own account campaigns"
  ON campaigns FOR UPDATE
  USING (account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own account campaigns"
  ON campaigns FOR DELETE
  USING (account_id IN (
    SELECT account_id FROM users WHERE id = auth.uid()
  ));

-- Campaign contacts: users can access through campaign relationship
CREATE POLICY "Users can view campaign contacts"
  ON campaign_contacts FOR SELECT
  USING (campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN users u ON u.account_id = c.account_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can insert campaign contacts"
  ON campaign_contacts FOR INSERT
  WITH CHECK (campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN users u ON u.account_id = c.account_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can update campaign contacts"
  ON campaign_contacts FOR UPDATE
  USING (campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN users u ON u.account_id = c.account_id
    WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can delete campaign contacts"
  ON campaign_contacts FOR DELETE
  USING (campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN users u ON u.account_id = c.account_id
    WHERE u.id = auth.uid()
  ));

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns
  SET
    total_contacts = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)),
    contacts_called = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) AND attempts > 0),
    contacts_connected = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) AND outcome = 'answered'),
    contacts_completed = (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) AND status = 'completed'),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update stats
DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON campaign_contacts;
CREATE TRIGGER trigger_update_campaign_stats
  AFTER INSERT OR UPDATE OR DELETE ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_stats();

-- Comments
COMMENT ON TABLE campaigns IS 'Outbound calling campaigns';
COMMENT ON TABLE campaign_contacts IS 'Contacts assigned to campaigns with call status';
