import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getUserFromAuth } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { validateRequired, validateAreaCode, parseJsonBody } from "../_shared/validation.ts";
import {
  getTwilioCredentials,
  isLocalSubaccountMode,
  isDevMode,
  getLocalSubaccountConfig,
  createSubaccount,
  getSubaccount,
  listSubaccounts,
  searchAvailableNumbers,
  purchasePhoneNumber as twiliourchaseNumber,
  listPhoneNumbers,
  generateMockPhoneNumber,
  TwilioSubaccount,
} from "../_shared/twilio.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('purchase-phone-number');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step('Starting phone number purchase');

    // Check environment
    const devMode = isDevMode();
    const useLocalSubaccount = isLocalSubaccountMode();

    log.info('Environment check', {
      devMode,
      useLocalSubaccount,
      isLocal: config.isLocal,
    });

    // Skip Twilio credentials check in dev mode
    let twilioCredentials: { accountSid: string; authToken: string } | null = null;
    if (!devMode) {
      twilioCredentials = getTwilioCredentials();
    }

    // Authenticate user
    const supabaseAdmin = createServiceClient();
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await getUserFromAuth(authHeader);

    if (authError || !user) {
      return errorResponse(authError || 'Invalid token', 401);
    }

    log.info('User authenticated', { userId: user.id });

    // Get user's organization
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return errorResponse('No organization found', 404);
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', profile.organization_id)
      .single();

    if (orgError || !org) {
      return errorResponse('Organization not found', 404);
    }

    log.info('Organization found', { orgId: org.id, orgName: org.name });

    // Parse request body
    const { businessPhoneNumber, areaCode } = await parseJsonBody<{
      businessPhoneNumber: string;
      areaCode: string;
    }>(req, ['businessPhoneNumber', 'areaCode']);

    validateRequired(businessPhoneNumber, 'Business phone number');
    const validAreaCode = validateAreaCode(areaCode);

    // Resolve Twilio subaccount
    let subaccount: TwilioSubaccount = {
      sid: org.twilio_subaccount_sid || '',
      authToken: org.twilio_subaccount_auth_token || '',
    };

    // Dev mode: use mock credentials
    if (devMode) {
      log.step('DEV MODE: Skipping subaccount creation');
      subaccount = { sid: 'DEV_MODE_MOCK', authToken: 'DEV_MODE_MOCK' };
    }
    // Local mode: use local subaccount
    else if (useLocalSubaccount) {
      log.step('Using local subaccount mode');
      const localConfig = getLocalSubaccountConfig();

      if (localConfig.sid && !localConfig.sid.includes('YOUR_')) {
        log.info('Using provided local subaccount', { sid: localConfig.sid });

        if (localConfig.authToken) {
          subaccount = { sid: localConfig.sid, authToken: localConfig.authToken };
        } else {
          // Fetch auth token from API
          const fetchedSubaccount = await getSubaccount(localConfig.sid, twilioCredentials!);
          subaccount = fetchedSubaccount;
        }
      } else {
        // Search for subaccount named "local"
        log.step('Searching for subaccount named "local"');
        const subaccounts = await listSubaccounts(twilioCredentials!, 'local');

        if (subaccounts.length === 0) {
          return errorResponse(
            'No subaccount named "local" found. Please create one or set LOCAL_SUBACCOUNT_SID',
            400
          );
        }

        subaccount = subaccounts[0];
        log.info('Found local subaccount', { sid: subaccount.sid, name: subaccount.friendlyName });
      }

      // Save to org if not already saved
      if (org.twilio_subaccount_sid !== subaccount.sid) {
        await supabaseAdmin
          .from('organizations')
          .update({
            twilio_subaccount_sid: subaccount.sid,
            twilio_subaccount_auth_token: subaccount.authToken,
          })
          .eq('id', org.id);
      }
    }
    // Production: create or use existing subaccount
    else if (!subaccount.sid) {
      log.step('Creating Twilio subaccount');
      const friendlyName = `AnswerAfter-${org.name.substring(0, 20)}-${org.id.substring(0, 8)}`;
      subaccount = await createSubaccount(friendlyName, twilioCredentials!);

      // Save subaccount to org
      await supabaseAdmin
        .from('organizations')
        .update({
          twilio_subaccount_sid: subaccount.sid,
          twilio_subaccount_auth_token: subaccount.authToken,
        })
        .eq('id', org.id);

      log.info('Subaccount created', { sid: subaccount.sid });
    }

    // Purchase or get phone number
    let purchasedNumber: { sid: string; phone_number: string };
    const webhookUrl = `${config.supabase.url}/functions/v1/twilio-webhook`;

    // Dev mode: create mock phone number
    if (devMode) {
      log.step('DEV MODE: Creating mock phone number');
      const mockNumber = generateMockPhoneNumber(validAreaCode);
      purchasedNumber = {
        sid: mockNumber.sid,
        phone_number: mockNumber.phone_number,
      };
      log.info('Mock number created', { phoneNumber: purchasedNumber.phone_number });
    }
    // Local mode: use existing number from subaccount
    else if (useLocalSubaccount) {
      log.step('Local mode: Looking for existing numbers');
      const existingNumbers = await listPhoneNumbers(subaccount);

      if (existingNumbers.length === 0) {
        return errorResponse(
          'No existing numbers found in local subaccount. Please add a phone number first.',
          400
        );
      }

      purchasedNumber = {
        sid: existingNumbers[0].sid,
        phone_number: existingNumbers[0].phone_number,
      };

      log.info('Using existing number (webhook not updated in local mode)', {
        phoneNumber: purchasedNumber.phone_number,
      });
    }
    // Production: search and purchase new number
    else {
      log.step('Searching for available number', { areaCode: validAreaCode });
      const availableNumbers = await searchAvailableNumbers(subaccount, validAreaCode);

      if (availableNumbers.length === 0) {
        return errorResponse(`No phone numbers available in area code ${validAreaCode}`, 400);
      }

      const selectedNumber = availableNumbers[0];
      log.info('Found available number', { phoneNumber: selectedNumber.phoneNumber });

      // Purchase the phone number
      const purchased = await twiliourchaseNumber(
        subaccount,
        selectedNumber.phoneNumber,
        webhookUrl
      );

      purchasedNumber = {
        sid: purchased.sid,
        phone_number: purchased.phone_number,
      };

      log.info('Number purchased', { phoneNumber: purchasedNumber.phone_number, sid: purchasedNumber.sid });
    }

    // Save business phone number to organization
    const { error: orgUpdateError } = await supabaseAdmin
      .from('organizations')
      .update({ business_phone_number: businessPhoneNumber })
      .eq('id', org.id);

    if (orgUpdateError) {
      log.warn('Org update error', { error: orgUpdateError.message });
    }

    // Save purchased number to database
    const { error: insertError } = await supabaseAdmin
      .from('phone_numbers')
      .insert({
        organization_id: org.id,
        phone_number: purchasedNumber.phone_number,
        friendly_name: `Business Line (${validAreaCode})`,
        is_shared: false,
        is_active: true,
        twilio_sid: purchasedNumber.sid,
        provisioned_at: new Date().toISOString(),
      });

    if (insertError) {
      log.warn('DB insert error', { error: insertError.message });
      // Don't throw - number is purchased, just failed to save
    }

    // DO NOT mark onboarding as complete yet - we have more steps
    // DO NOT create ElevenLabs agent here - that happens in setup-services based on plan

    log.step('Phone number purchase complete');

    return successResponse({
      success: true,
      phoneNumber: purchasedNumber.phone_number,
      twilioSid: purchasedNumber.sid,
      businessPhoneNumber,
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
