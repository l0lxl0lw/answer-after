import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import type { OrganizationProvisionRequest, OrganizationProvisionResponse } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logger = createLogger('provision-organization');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create anon client to get user from token
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY ?? '');

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    const reqLogger = logger.withContext({ userId: user.id, email: user.email });
    reqLogger.info('User authenticated');

    // Get organization name, notification phone, timezone, and planId from user metadata or request body
    let organizationName = user.user_metadata?.organization_name;
    let notificationPhone: string | null = null;
    let timezone = 'America/New_York'; // Default timezone
    let planId = 'core'; // Default plan

    // Try to get from request body if not in metadata
    try {
      const body = await req.json();
      if (body.organizationName) {
        organizationName = body.organizationName;
      }
      if (body.notificationPhone) {
        notificationPhone = body.notificationPhone;
      }
      if (body.timezone) {
        timezone = body.timezone;
      }
      if (body.planId) {
        planId = body.planId;
      }
    } catch {
      // No body or invalid JSON, continue with metadata
    }

    if (!organizationName) {
      organizationName = `${user.email?.split('@')[0]}'s Organization`;
    }

    // Note: Environment prefix is now added to agent name instead (e.g., [LOCAL][INBOUND])

    reqLogger.info('Organization name determined', { organizationName, hasPhone: !!notificationPhone, timezone, planId, environment: config.environment });

    // Check if user already has an organization
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (existingProfile?.organization_id) {
      reqLogger.info('User already has organization', { orgId: existingProfile.organization_id });
      
      // Return existing org info
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', existingProfile.organization_id)
        .single();

      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', existingProfile.organization_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Organization already exists',
          organizationId: existingProfile.organization_id,
          organization: org,
          subscription
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create the organization
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50) + '-' + user.id.substring(0, 8);

    reqLogger.step('Creating organization', { slug });

    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organizationName,
        slug,
        timezone: timezone,
        notification_email: user.email,
        notification_phone: notificationPhone,
      })
      .select()
      .single();

    if (orgError) {
      reqLogger.error('Failed to create organization', orgError);
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }

    reqLogger.info('Organization created', { orgId: newOrg.id });

    // 2. Update user profile with organization_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: newOrg.id })
      .eq('id', user.id);

    if (profileError) {
      reqLogger.error('Failed to update profile', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    reqLogger.step('Profile updated with organization');

    // 3. Create user role as owner
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: 'owner'
      });

    if (roleError) {
      reqLogger.error('Failed to create user role', roleError);
      throw new Error(`Failed to create user role: ${roleError.message}`);
    }

    reqLogger.step('User role created as owner');

    // 4. Create subscription (trial on selected plan)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    // Get credits for the selected plan
    const { data: tierData } = await supabaseAdmin
      .from('subscription_tiers')
      .select('credits')
      .eq('plan_id', planId)
      .single();

    const totalCredits = tierData?.credits || 250;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        organization_id: newOrg.id,
        plan: planId,
        status: 'trial',
        total_credits: totalCredits,
        used_credits: 0,
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndDate.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      reqLogger.error('Failed to create subscription', subError);
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    reqLogger.step('Subscription created', { plan: planId, status: 'trial', credits: totalCredits });

    // 5. Create organization_agents record (placeholder - agent created after payment)
    const agentContext = JSON.stringify({
      orgName: organizationName,
      businessType: 'Service Business',
      services: [],
    });

    const { error: agentError } = await supabaseAdmin
      .from('organization_agents')
      .insert({
        organization_id: newOrg.id,
        context: agentContext
      });

    if (agentError) {
      reqLogger.warn('Error creating agent record (non-fatal)', { error: agentError.message });
    } else {
      reqLogger.step('Organization agent record created');
    }

    // Note: Twilio subaccount, phone number, and ElevenLabs agent are now created
    // via the run-onboarding function after Stripe payment completes

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Organization provisioned successfully. Complete payment to activate phone and agent.',
        organizationId: newOrg.id,
        organization: newOrg,
        subscription,
        nextStep: 'Complete payment to provision phone number and AI agent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Provisioning failed', error as Error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
