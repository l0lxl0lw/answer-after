import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetupRequest {
  organizationId: string;
  subscriptionPlan: string;
  organizationName: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { organizationId, subscriptionPlan, organizationName } = await req.json() as SetupRequest;

    console.log(`Setting up Twilio for org: ${organizationId}, plan: ${subscriptionPlan}`);

    const isFreeTier = subscriptionPlan === 'free' || subscriptionPlan === 'starter';

    if (isFreeTier) {
      // For free tier, assign a shared phone number from the pool
      const result = await assignSharedPhoneNumber(supabase, organizationId);
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // For paid tiers, create a dedicated sub-account and provision a number
      const result = await createDedicatedSubaccount(
        supabase,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        organizationId,
        organizationName
      );
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in setup-twilio-subaccount:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function assignSharedPhoneNumber(supabase: any, organizationId: string) {
  console.log(`Assigning shared phone number for org: ${organizationId}`);

  // Check if org already has a phone number
  const { data: existingPhones } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (existingPhones && existingPhones.length > 0) {
    console.log('Organization already has a phone number assigned');
    return {
      success: true,
      message: 'Phone number already assigned',
      phoneNumber: existingPhones[0].phone_number,
      isShared: existingPhones[0].is_shared
    };
  }

  // Find an available shared phone from the pool
  const { data: availablePhones, error: poolError } = await supabase
    .from('free_tier_phone_pool')
    .select('*')
    .eq('is_available', true)
    .lt('assigned_count', 50) // Max 50 orgs per shared number
    .order('assigned_count', { ascending: true })
    .limit(1);

  if (poolError || !availablePhones || availablePhones.length === 0) {
    console.error('No shared phone numbers available in pool:', poolError);
    return {
      success: false,
      error: 'No shared phone numbers available. Please contact support.'
    };
  }

  const sharedPhone = availablePhones[0];
  console.log(`Assigning shared phone: ${sharedPhone.phone_number}`);

  // Assign the phone to the organization
  const { error: insertError } = await supabase
    .from('phone_numbers')
    .insert({
      organization_id: organizationId,
      phone_number: sharedPhone.phone_number,
      friendly_name: `Shared Line`,
      is_shared: true,
      is_active: true,
      twilio_sid: sharedPhone.twilio_sid,
      provisioned_at: new Date().toISOString()
    });

  if (insertError) {
    console.error('Error assigning phone number:', insertError);
    return { success: false, error: 'Failed to assign phone number' };
  }

  // Update the pool count
  const newCount = sharedPhone.assigned_count + 1;
  await supabase
    .from('free_tier_phone_pool')
    .update({
      assigned_count: newCount,
      is_available: newCount < sharedPhone.max_assignments
    })
    .eq('id', sharedPhone.id);

  return {
    success: true,
    message: 'Shared phone number assigned',
    phoneNumber: sharedPhone.phone_number,
    isShared: true
  };
}

async function createDedicatedSubaccount(
  supabase: any,
  masterAccountSid: string,
  masterAuthToken: string,
  organizationId: string,
  organizationName: string
) {
  console.log(`Creating dedicated sub-account for org: ${organizationId}`);

  // Check if org already has a sub-account
  const { data: org } = await supabase
    .from('organizations')
    .select('twilio_subaccount_sid')
    .eq('id', organizationId)
    .single();

  if (org?.twilio_subaccount_sid) {
    console.log('Organization already has a sub-account');
    // Check if they have a phone number
    const { data: phones } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_shared', false);

    if (phones && phones.length > 0) {
      return {
        success: true,
        message: 'Sub-account and phone number already configured',
        subaccountSid: org.twilio_subaccount_sid,
        phoneNumber: phones[0].phone_number
      };
    }
  }

  // Create Twilio sub-account
  const friendlyName = `AnswerAfter-${organizationName.substring(0, 20)}-${organizationId.substring(0, 8)}`;
  
  const subaccountResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${masterAccountSid}:${masterAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        FriendlyName: friendlyName
      })
    }
  );

  if (!subaccountResponse.ok) {
    const errorText = await subaccountResponse.text();
    console.error('Failed to create Twilio sub-account:', errorText);
    return { success: false, error: 'Failed to create Twilio sub-account' };
  }

  const subaccount = await subaccountResponse.json();
  console.log(`Created sub-account: ${subaccount.sid}`);

  // Save sub-account to organization
  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      twilio_subaccount_sid: subaccount.sid,
      twilio_subaccount_auth_token: subaccount.auth_token
    })
    .eq('id', organizationId);

  if (updateError) {
    console.error('Error saving sub-account:', updateError);
    return { success: false, error: 'Failed to save sub-account configuration' };
  }

  // Provision a phone number for this sub-account
  const phoneResult = await provisionPhoneNumber(
    supabase,
    subaccount.sid,
    subaccount.auth_token,
    organizationId
  );

  return {
    success: phoneResult.success,
    message: phoneResult.success ? 'Dedicated sub-account and phone number created' : phoneResult.error,
    subaccountSid: subaccount.sid,
    phoneNumber: phoneResult.phoneNumber
  };
}

async function provisionPhoneNumber(
  supabase: any,
  subaccountSid: string,
  subaccountAuthToken: string,
  organizationId: string
) {
  console.log(`Provisioning phone number for sub-account: ${subaccountSid}`);

  // Search for available US phone numbers
  const searchResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&Limit=1`,
    {
      headers: {
        'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`
      }
    }
  );

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error('Failed to search for phone numbers:', errorText);
    return { success: false, error: 'Failed to find available phone numbers' };
  }

  const searchResult = await searchResponse.json();
  
  if (!searchResult.available_phone_numbers || searchResult.available_phone_numbers.length === 0) {
    console.error('No phone numbers available');
    return { success: false, error: 'No phone numbers available in your region' };
  }

  const availableNumber = searchResult.available_phone_numbers[0];
  console.log(`Found available number: ${availableNumber.phone_number}`);

  // Get the webhook URL for incoming calls
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-webhook`;

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
        PhoneNumber: availableNumber.phone_number,
        VoiceUrl: webhookUrl,
        VoiceMethod: 'POST'
      })
    }
  );

  if (!purchaseResponse.ok) {
    const errorText = await purchaseResponse.text();
    console.error('Failed to purchase phone number:', errorText);
    return { success: false, error: 'Failed to purchase phone number' };
  }

  const purchasedNumber = await purchaseResponse.json();
  console.log(`Purchased number: ${purchasedNumber.phone_number}, SID: ${purchasedNumber.sid}`);

  // Save the phone number to the database
  const { error: insertError } = await supabase
    .from('phone_numbers')
    .insert({
      organization_id: organizationId,
      phone_number: purchasedNumber.phone_number,
      friendly_name: availableNumber.friendly_name || 'Dedicated Line',
      is_shared: false,
      is_active: true,
      twilio_sid: purchasedNumber.sid,
      provisioned_at: new Date().toISOString()
    });

  if (insertError) {
    console.error('Error saving phone number:', insertError);
    return { success: false, error: 'Failed to save phone number configuration' };
  }

  return {
    success: true,
    phoneNumber: purchasedNumber.phone_number,
    twilioSid: purchasedNumber.sid
  };
}
