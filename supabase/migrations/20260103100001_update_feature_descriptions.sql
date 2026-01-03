-- Update feature descriptions with clearer, benefit-oriented progressive language

UPDATE subscription_tiers
SET features = '["24/7 AI call answering", "100 minutes/month", "100 SMS/month", "Appointment scheduling", "Email notifications"]'::jsonb
WHERE plan_id = 'core';

UPDATE subscription_tiers
SET features = '["Everything in Core, plus:", "250 minutes/month", "250 SMS/month", "Call recordings & transcripts", "Custom AI greeting"]'::jsonb
WHERE plan_id = 'growth';

UPDATE subscription_tiers
SET features = '["Everything in Growth, plus:", "500 minutes/month", "500 SMS/month", "Custom AI personality", "Custom knowledge training", "Priority support"]'::jsonb
WHERE plan_id = 'pro';

UPDATE subscription_tiers
SET features = '["Everything in Pro, plus:", "1,200 minutes/month", "2,000 SMS/month", "Outbound appointment reminders", "Multi-language support", "Dedicated account manager", "SLA guarantee"]'::jsonb
WHERE plan_id = 'business';

UPDATE subscription_tiers
SET features = '["Everything in Business, plus:", "Unlimited minutes", "Unlimited SMS", "HIPAA compliance", "Custom integrations", "White-label options", "24/7 priority support"]'::jsonb
WHERE plan_id = 'enterprise';
