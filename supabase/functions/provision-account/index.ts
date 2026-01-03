import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";
import { DEFAULT_PLAN, type AccountProvisionRequest, type AccountProvisionResponse } from "../_shared/types.ts";

const logger = createLogger('provision-account');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseAdmin = createServiceClient();
    const supabaseAnon = createAnonClient();

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

    const log = logger.withContext({ userId: user.id, email: user.email });
    log.info('User authenticated');

    // Get account name, notification phone, business phone, timezone, and planId from user metadata or request body
    let accountName = user.user_metadata?.account_name || user.user_metadata?.institution_name;
    let notificationPhone: string | null = null;
    let businessPhone: string | null = null;
    let timezone = 'America/New_York';
    let planId = DEFAULT_PLAN;

    try {
      const body = await req.json();
      if (body.accountName || body.institutionName) {
        accountName = body.accountName || body.institutionName;
      }
      if (body.notificationPhone) {
        notificationPhone = body.notificationPhone;
      }
      if (body.businessPhone) {
        businessPhone = body.businessPhone;
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

    if (!accountName) {
      accountName = `${user.email?.split('@')[0]}'s Account`;
    }

    log.info('Account name determined', { accountName, hasPhone: !!notificationPhone, timezone, planId, environment: config.environment });

    // Check if user already has an account
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (existingProfile?.account_id) {
      log.info('User already has account', { accountId: existingProfile.account_id });

      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('id', existingProfile.account_id)
        .single();

      // Get tier credits for the selected plan
      const { data: tierData } = await supabaseAdmin
        .from('subscription_tiers')
        .select('credits')
        .eq('plan_id', planId)
        .single();

      const totalCredits = tierData?.credits || 250;

      // Update subscription to the selected plan (in case user is re-selecting during onboarding)
      const { data: subscription, error: subUpdateError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          account_id: existingProfile.account_id,
          plan: planId,
          status: 'trial',
          total_credits: totalCredits,
          used_credits: 0,
        }, {
          onConflict: 'account_id'
        })
        .select()
        .single();

      if (subUpdateError) {
        log.warn('Failed to update subscription', { error: subUpdateError.message });
      } else {
        log.info('Subscription updated to selected plan', { plan: planId, credits: totalCredits });
      }

      return successResponse({
        success: true,
        message: 'Account already exists',
        accountId: existingProfile.account_id,
        account,
        subscription
      });
    }

    // 1. Create the account
    const slug = accountName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50) + '-' + user.id.substring(0, 8);

    log.step('Creating account', { slug });

    const { data: newAccount, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        name: accountName,
        slug,
        timezone: timezone,
        notification_email: user.email,
        notification_phone: notificationPhone,
        business_phone_number: businessPhone,
      })
      .select()
      .single();

    if (accountError) {
      log.error('Failed to create account', accountError);
      throw new Error(`Failed to create account: ${accountError.message}`);
    }

    log.info('Account created', { accountId: newAccount.id });

    // 2. Update user record with account_id
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({ account_id: newAccount.id })
      .eq('id', user.id);

    if (profileError) {
      log.error('Failed to update user', profileError);
      throw new Error(`Failed to update user: ${profileError.message}`);
    }

    log.step('User updated with account');

    // 3. Create user role as owner
    const { error: roleError } = await supabaseAdmin
      .from('roles')
      .insert({
        user_id: user.id,
        role: 'owner'
      });

    if (roleError) {
      log.error('Failed to create user role', roleError);
      throw new Error(`Failed to create user role: ${roleError.message}`);
    }

    log.step('User role created as owner');

    // 4. Create subscription (trial on selected plan)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const { data: tierData } = await supabaseAdmin
      .from('subscription_tiers')
      .select('credits')
      .eq('plan_id', planId)
      .single();

    const totalCredits = tierData?.credits || 250;

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        account_id: newAccount.id,
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
      log.error('Failed to create subscription', subError);
      throw new Error(`Failed to create subscription: ${subError.message}`);
    }

    log.step('Subscription created', { plan: planId, status: 'trial', credits: totalCredits });

    // 5. Create account_agents record (placeholder - agent created after payment)
    const agentContext = JSON.stringify({
      accountName: accountName,
      businessType: 'Service Business',
      services: [],
    });

    const { error: agentError } = await supabaseAdmin
      .from('account_agents')
      .insert({
        account_id: newAccount.id,
        context: agentContext
      });

    if (agentError) {
      log.warn('Error creating agent record (non-fatal)', { error: agentError.message });
    } else {
      log.step('Account agent record created');
    }

    // 6. Seed default provider roles
    const { error: rolesError } = await supabaseAdmin.rpc('seed_default_provider_roles', {
      p_account_id: newAccount.id
    });

    if (rolesError) {
      log.warn('Error seeding default provider roles (non-fatal)', { error: rolesError.message });
    } else {
      log.step('Default provider roles seeded');
    }

    return successResponse({
      success: true,
      message: 'Account provisioned successfully. Complete payment to activate phone and agent.',
      accountId: newAccount.id,
      account: newAccount,
      subscription,
      nextStep: 'Complete payment to provision phone number and AI agent'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Provisioning failed', error as Error);
    return errorResponse(errorMessage, 500);
  }
});
