-- Add SMS limit column to subscription tiers
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS sms_limit integer DEFAULT 0;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS phone_lines integer DEFAULT 1;

-- Update SMS limits for each tier
UPDATE subscription_tiers SET sms_limit = 100, phone_lines = 1 WHERE plan_id = 'core';
UPDATE subscription_tiers SET sms_limit = 250, phone_lines = 1 WHERE plan_id = 'growth';
UPDATE subscription_tiers SET sms_limit = 500, phone_lines = 2 WHERE plan_id = 'pro';
UPDATE subscription_tiers SET sms_limit = 2000, phone_lines = 5 WHERE plan_id = 'business';
UPDATE subscription_tiers SET sms_limit = -1, phone_lines = -1 WHERE plan_id = 'enterprise'; -- unlimited

-- Add comment for documentation
COMMENT ON COLUMN subscription_tiers.sms_limit IS 'Monthly SMS limit. -1 means unlimited.';
COMMENT ON COLUMN subscription_tiers.phone_lines IS 'Number of phone lines included. -1 means unlimited.';
