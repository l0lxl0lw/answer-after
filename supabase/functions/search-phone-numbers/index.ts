import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEARCH-PHONE] ${step}${detailsStr}`);
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

    // Get user's organization and Twilio subaccount
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
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', profile.organization_id)
      .single();

    // Use subaccount if available, otherwise use master account
    const accountSid = org?.twilio_subaccount_sid || TWILIO_ACCOUNT_SID;
    const authToken = org?.twilio_subaccount_auth_token || TWILIO_AUTH_TOKEN;

    const { numberType, areaCode } = await req.json();
    
    logStep('Searching numbers', { numberType, areaCode, orgId: profile.organization_id });

    let searchUrl: string;
    const searchParams = new URLSearchParams({
      VoiceEnabled: 'true',
      Limit: '3',
    });

    if (numberType === 'toll-free') {
      // Search toll-free numbers
      searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/US/TollFree.json?${searchParams}`;
    } else {
      // Search local numbers
      if (areaCode) {
        searchParams.set('AreaCode', areaCode);
      }
      searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/US/Local.json?${searchParams}`;
    }

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      logStep('Twilio search failed', { error: errorText });
      throw new Error('Failed to search phone numbers');
    }

    const searchResult = await searchResponse.json();
    
    const numbers = (searchResult.available_phone_numbers || []).map((num: any) => ({
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      locality: num.locality,
      region: num.region,
    }));

    logStep('Found numbers', { count: numbers.length });

    return new Response(
      JSON.stringify({ success: true, numbers }),
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
