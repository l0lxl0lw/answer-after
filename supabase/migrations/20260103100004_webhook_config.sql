-- Webhook configuration for accounts

-- Add webhook columns to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS webhook_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS webhook_secret text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS webhook_url text;

-- Comments
COMMENT ON COLUMN accounts.webhook_enabled IS 'Whether inbound webhooks are enabled for this account';
COMMENT ON COLUMN accounts.webhook_secret IS 'Secret key for authenticating webhook requests';
COMMENT ON COLUMN accounts.webhook_url IS 'Optional outbound webhook URL for sending events';
