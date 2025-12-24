import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function initializes the free-tier phone pool with shared numbers
// It creates a "free-tier" sub-account in Twilio and provisions 2 phone numbers
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
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if pool already has numbers
    const { data: existingPool } = await supabase
      .from('free_tier_phone_pool')
      .select('*');

    if (existingPool && existingPool.length >= 2) {
      console.log('Free tier pool already initialized with numbers');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pool already initialized',
          numbers: existingPool.map(p => p.phone_number)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if "free-tier" sub-account exists
    const listAccountsResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts.json?FriendlyName=AnswerAfter-FreeTier`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
        }
      }
    );

    const accountsList = await listAccountsResponse.json();
    let freeTierSubaccount;

    if (accountsList.accounts && accountsList.accounts.length > 0) {
      freeTierSubaccount = accountsList.accounts[0];
      console.log('Found existing free-tier sub-account:', freeTierSubaccount.sid);
    } else {
      // Create the free-tier sub-account
      console.log('Creating free-tier sub-account...');
      const createResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            FriendlyName: 'AnswerAfter-FreeTier'
          })
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create free-tier sub-account:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to create free-tier sub-account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      freeTierSubaccount = await createResponse.json();
      console.log('Created free-tier sub-account:', freeTierSubaccount.sid);
    }

    // Get the webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-webhook`;

    // Provision 2 phone numbers for the free tier pool
    const numbersToProvision = 2 - (existingPool?.length || 0);
    const provisionedNumbers = [];

    for (let i = 0; i < numbersToProvision; i++) {
      // Search for available numbers
      const searchResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${freeTierSubaccount.sid}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&Limit=1`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${freeTierSubaccount.sid}:${freeTierSubaccount.auth_token}`)}`
          }
        }
      );

      const searchResult = await searchResponse.json();

      if (!searchResult.available_phone_numbers || searchResult.available_phone_numbers.length === 0) {
        console.error('No phone numbers available');
        continue;
      }

      const availableNumber = searchResult.available_phone_numbers[0];
      console.log(`Found available number: ${availableNumber.phone_number}`);

      // Purchase the number
      const purchaseResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${freeTierSubaccount.sid}/IncomingPhoneNumbers.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${freeTierSubaccount.sid}:${freeTierSubaccount.auth_token}`)}`,
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
        continue;
      }

      const purchasedNumber = await purchaseResponse.json();
      console.log(`Purchased number: ${purchasedNumber.phone_number}`);

      // Add to pool
      const { error: insertError } = await supabase
        .from('free_tier_phone_pool')
        .insert({
          phone_number: purchasedNumber.phone_number,
          twilio_sid: purchasedNumber.sid,
          friendly_name: `Free Tier Line ${i + 1 + (existingPool?.length || 0)}`,
          is_available: true,
          assigned_count: 0,
          max_assignments: 50
        });

      if (insertError) {
        console.error('Error adding to pool:', insertError);
      } else {
        provisionedNumbers.push(purchasedNumber.phone_number);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Initialized free tier pool with ${provisionedNumbers.length} new numbers`,
        numbers: provisionedNumbers,
        subaccountSid: freeTierSubaccount.sid
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error initializing free tier pool:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
