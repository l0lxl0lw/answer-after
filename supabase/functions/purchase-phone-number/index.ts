import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-PHONE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const USE_LOCAL_SUBACCOUNT = Deno.env.get('USE_LOCAL_SUBACCOUNT') === 'true';
    const LOCAL_SUBACCOUNT_SID = Deno.env.get('LOCAL_SUBACCOUNT_SID');

    // Debug logging
    logStep('Environment check', {
      hasTwilioSid: !!TWILIO_ACCOUNT_SID,
      hasTwilioToken: !!TWILIO_AUTH_TOKEN,
      useLocal: USE_LOCAL_SUBACCOUNT,
      hasLocalSid: !!LOCAL_SUBACCOUNT_SID,
    });

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    // Authenticate user
    const supabaseAnon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Get user's organization
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('No organization found');
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, name, twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', profile.organization_id)
      .single();

    if (!org) {
      throw new Error('Organization not found');
    }

    // Ensure org has Twilio subaccount
    let subaccountSid = org.twilio_subaccount_sid;
    let subaccountAuthToken = org.twilio_subaccount_auth_token;

    // Use local subaccount for development if configured
    if (USE_LOCAL_SUBACCOUNT) {
      logStep('Looking for subaccount named "local"');

      // If SID provided, use it directly
      if (LOCAL_SUBACCOUNT_SID && !LOCAL_SUBACCOUNT_SID.includes('YOUR_')) {
        logStep('Using provided local subaccount', { sid: LOCAL_SUBACCOUNT_SID });

        const subaccountResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${LOCAL_SUBACCOUNT_SID}.json`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            }
          }
        );

        if (!subaccountResponse.ok) {
          throw new Error('Failed to fetch local subaccount details');
        }

        const subaccountData = await subaccountResponse.json();
        subaccountSid = subaccountData.sid;
        subaccountAuthToken = subaccountData.auth_token;
      } else {
        // Search for subaccount named "local"
        logStep('Searching for subaccount named "local"');

        const listResponse = await fetch(
          'https://api.twilio.com/2010-04-01/Accounts.json',
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            }
          }
        );

        if (!listResponse.ok) {
          throw new Error('Failed to list subaccounts');
        }

        const listData = await listResponse.json();
        const localSubaccount = listData.accounts?.find((acc: any) =>
          acc.friendly_name?.toLowerCase().includes('local')
        );

        if (!localSubaccount) {
          throw new Error('No subaccount named "local" found. Please create one or set LOCAL_SUBACCOUNT_SID');
        }

        logStep('Found local subaccount', {
          sid: localSubaccount.sid,
          name: localSubaccount.friendly_name
        });

        subaccountSid = localSubaccount.sid;
        subaccountAuthToken = localSubaccount.auth_token;
      }

      // Save to org if not already saved
      if (org.twilio_subaccount_sid !== subaccountSid) {
        await supabaseAdmin
          .from('organizations')
          .update({
            twilio_subaccount_sid: subaccountSid,
            twilio_subaccount_auth_token: subaccountAuthToken
          })
          .eq('id', org.id);
      }
    } else if (!subaccountSid) {
      // Create Twilio subaccount first
      logStep('Creating Twilio subaccount');

      const friendlyName = `AnswerAfter-${org.name.substring(0, 20)}-${org.id.substring(0, 8)}`;

      const subaccountResponse = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts.json',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ FriendlyName: friendlyName })
        }
      );

      if (!subaccountResponse.ok) {
        const errorText = await subaccountResponse.text();
        logStep('Subaccount creation failed', { error: errorText });
        throw new Error('Failed to create Twilio subaccount');
      }

      const subaccount = await subaccountResponse.json();
      subaccountSid = subaccount.sid;
      subaccountAuthToken = subaccount.auth_token;

      // Save subaccount to org
      await supabaseAdmin
        .from('organizations')
        .update({
          twilio_subaccount_sid: subaccountSid,
          twilio_subaccount_auth_token: subaccountAuthToken
        })
        .eq('id', org.id);

      logStep('Subaccount created', { sid: subaccountSid });
    }

    const { businessPhoneNumber, areaCode } = await req.json();

    if (!businessPhoneNumber || !areaCode) {
      throw new Error('Business phone number and area code are required');
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-webhook`;
    let purchasedNumber: any;

    // If using local subaccount, grab an existing number instead of purchasing
    if (USE_LOCAL_SUBACCOUNT) {
      logStep('Local mode: Looking for existing numbers in local subaccount', { orgId: org.id });

      // Get existing numbers from the local subaccount
      const existingResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`,
          }
        }
      );

      if (!existingResponse.ok) {
        const errorText = await existingResponse.text();
        logStep('Failed to fetch existing numbers', { error: errorText });
        throw new Error('Failed to fetch existing numbers from local subaccount');
      }

      const existingData = await existingResponse.json();
      const availableNumbers = existingData.incoming_phone_numbers || [];

      if (availableNumbers.length === 0) {
        throw new Error('No existing numbers found in local subaccount. Please add a phone number to your "local" subaccount first.');
      }

      // Use the first available number
      purchasedNumber = availableNumbers[0];

      // In local mode, skip webhook configuration since internal URLs won't work
      // The webhook can be manually configured in Twilio console if needed for testing
      logStep('Local mode: Using existing number (webhook not updated)', {
        phoneNumber: purchasedNumber.phone_number,
        sid: purchasedNumber.sid,
        note: 'Webhook not updated in local mode - configure manually if needed'
      });
    } else {
      // Production flow: Search and purchase a new number
      logStep('Searching for number', { areaCode, orgId: org.id });

      const searchResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&Limit=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`,
          }
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        logStep('Search failed', { error: errorText });
        throw new Error('Failed to search for available numbers');
      }

      const searchResults = await searchResponse.json();

      if (!searchResults.available_phone_numbers || searchResults.available_phone_numbers.length === 0) {
        throw new Error(`No phone numbers available in area code ${areaCode}`);
      }

      const selectedNumber = searchResults.available_phone_numbers[0];
      const phoneNumber = selectedNumber.phone_number;

      logStep('Found available number', { phoneNumber, areaCode });

      // Purchase the phone number
      const purchaseResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            PhoneNumber: phoneNumber,
            VoiceUrl: webhookUrl,
            VoiceMethod: 'POST'
          })
        }
      );

      if (!purchaseResponse.ok) {
        const errorText = await purchaseResponse.text();
        logStep('Purchase failed', { error: errorText });
        throw new Error('Failed to purchase phone number. It may no longer be available.');
      }

      purchasedNumber = await purchaseResponse.json();

      logStep('Number purchased', {
        phoneNumber: purchasedNumber.phone_number,
        sid: purchasedNumber.sid
      });
    }

    // Save business phone number to organizations
    const { error: orgUpdateError } = await supabaseAdmin
      .from('organizations')
      .update({
        business_phone_number: businessPhoneNumber,
      })
      .eq('id', org.id);

    if (orgUpdateError) {
      logStep('Org update error', { error: orgUpdateError });
    }

    // Save purchased number to database
    const { error: insertError } = await supabaseAdmin
      .from('phone_numbers')
      .insert({
        organization_id: org.id,
        phone_number: purchasedNumber.phone_number,
        friendly_name: `Business Line (${areaCode})`,
        is_shared: false,
        is_active: true,
        twilio_sid: purchasedNumber.sid,
        provisioned_at: new Date().toISOString()
      });

    if (insertError) {
      logStep('DB insert error', { error: insertError });
      // Don't throw - number is purchased, just failed to save
    }

    // DO NOT mark onboarding as complete yet - we have more steps
    // Onboarding will be complete after the test call step

    // Trigger ElevenLabs agent creation if not already done
    const { data: agentRecord } = await supabaseAdmin
      .from('organization_agents')
      .select('elevenlabs_agent_id')
      .eq('organization_id', org.id)
      .maybeSingle();

    if (!agentRecord?.elevenlabs_agent_id) {
      logStep('Creating ElevenLabs agent');

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'create-agent',
            organizationId: org.id,
          }),
        });
      } catch (agentError) {
        logStep('Agent creation error (non-fatal)', { error: String(agentError) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        phoneNumber: purchasedNumber.phone_number,
        twilioSid: purchasedNumber.sid,
        businessPhoneNumber,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
