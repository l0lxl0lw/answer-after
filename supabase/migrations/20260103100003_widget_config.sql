-- Widget configuration for accounts

-- Add widget columns to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS widget_enabled boolean DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS widget_config jsonb DEFAULT '{}';

-- Widget config structure: { position, primaryColor, greeting, buttonText }

-- Comments
COMMENT ON COLUMN accounts.widget_enabled IS 'Whether the website voice widget is enabled for this account';
COMMENT ON COLUMN accounts.widget_config IS 'Configuration for the website voice widget (position, colors, greeting)';
