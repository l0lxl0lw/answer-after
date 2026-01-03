import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('admin-list-accounts');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseAdmin = createServiceClient();

    // Fetch all accounts with related data
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(`
        id,
        name,
        slug,
        created_at,
        is_onboarding_complete,
        phone_numbers(phone_number),
        subscriptions(plan, status, stripe_subscription_id),
        account_agents(elevenlabs_agent_id),
        users(email, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching accounts', error);
      throw error;
    }

    return successResponse({ success: true, data: accounts || [] });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
