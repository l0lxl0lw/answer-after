import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getUserFromAuth } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { getTwilioCredentials, makeTwilioRequest, getAccountUrl } from "../_shared/twilio.ts";

const logger = createLogger('search-phone-numbers');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const twilioCredentials = getTwilioCredentials();
    const supabaseAdmin = createServiceClient();

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await getUserFromAuth(authHeader);

    if (authError || !user) {
      return errorResponse(authError || 'Invalid token', 401);
    }

    // Get user's organization and Twilio subaccount
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return errorResponse('No organization found', 404);
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', profile.organization_id)
      .single();

    // Use subaccount if available, otherwise use master account
    const accountSid = org?.twilio_subaccount_sid || twilioCredentials.accountSid;
    const authToken = org?.twilio_subaccount_auth_token || twilioCredentials.authToken;

    const { numberType, areaCode } = await parseJsonBody<{
      numberType?: string;
      areaCode?: string;
    }>(req);

    log.step('Searching numbers', { numberType, areaCode, orgId: profile.organization_id });

    const searchParams = new URLSearchParams({
      VoiceEnabled: 'true',
      Limit: '3',
    });

    let endpoint: string;
    if (numberType === 'toll-free') {
      endpoint = `${getAccountUrl(accountSid)}/AvailablePhoneNumbers/US/TollFree.json?${searchParams}`;
    } else {
      if (areaCode) {
        searchParams.set('AreaCode', areaCode);
      }
      endpoint = `${getAccountUrl(accountSid)}/AvailablePhoneNumbers/US/Local.json?${searchParams}`;
    }

    const searchResult = await makeTwilioRequest<{
      available_phone_numbers: Array<{
        phone_number: string;
        friendly_name: string;
        locality: string;
        region: string;
      }>;
    }>(endpoint, { accountSid, authToken });

    const numbers = (searchResult.available_phone_numbers || []).map(num => ({
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      locality: num.locality,
      region: num.region,
    }));

    log.info('Found numbers', { count: numbers.length });

    return successResponse({ success: true, numbers });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
