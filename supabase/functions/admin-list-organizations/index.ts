import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('admin-list-organizations');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseAdmin = createServiceClient();

    // Fetch all organizations with related data
    const { data: organizations, error } = await supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        created_at,
        is_onboarding_complete,
        phone_numbers(phone_number),
        subscriptions(plan, status, stripe_subscription_id),
        organization_agents(elevenlabs_agent_id),
        profiles(email, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching organizations', error);
      throw error;
    }

    return successResponse({ success: true, data: organizations || [] });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
