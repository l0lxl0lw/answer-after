import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwilioMessage {
  sid: string;
  date_created: string;
  date_sent: string;
  direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  from: string;
  to: string;
  body: string;
  status: string;
  num_segments: string;
  price: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface TransformedMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  body: string;
  status: string;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Use anon key client for auth verification
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Use service role client for data queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization using service role client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization's phone numbers
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true);

    if (phoneError) {
      console.error('Phone numbers error:', phoneError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch phone numbers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ messages: [], meta: { total: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch SMS messages from Twilio for each phone number
    const allMessages: TransformedMessage[] = [];
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    for (const { phone_number } of phoneNumbers) {
      // Fetch messages sent TO this number (inbound)
      const inboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(phone_number)}&PageSize=50`;
      
      // Fetch messages sent FROM this number (outbound)
      const outboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(phone_number)}&PageSize=50`;

      try {
        // Fetch inbound messages
        const inboundResponse = await fetch(inboundUrl, {
          headers: {
            'Authorization': `Basic ${credentials}`,
          },
        });

        if (inboundResponse.ok) {
          const inboundData = await inboundResponse.json();
          const inboundMessages = (inboundData.messages || []).map((msg: TwilioMessage) => ({
            id: msg.sid,
            direction: 'inbound' as const,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            status: msg.status,
            created_at: msg.date_created,
            error_code: msg.error_code,
            error_message: msg.error_message,
          }));
          allMessages.push(...inboundMessages);
        }

        // Fetch outbound messages
        const outboundResponse = await fetch(outboundUrl, {
          headers: {
            'Authorization': `Basic ${credentials}`,
          },
        });

        if (outboundResponse.ok) {
          const outboundData = await outboundResponse.json();
          const outboundMessages = (outboundData.messages || []).map((msg: TwilioMessage) => ({
            id: msg.sid,
            direction: 'outbound' as const,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            status: msg.status,
            created_at: msg.date_created,
            error_code: msg.error_code,
            error_message: msg.error_message,
          }));
          allMessages.push(...outboundMessages);
        }
      } catch (fetchError) {
        console.error(`Error fetching SMS for ${phone_number}:`, fetchError);
      }
    }

    // Remove duplicates based on message ID and sort by date
    const uniqueMessages = Array.from(
      new Map(allMessages.map(msg => [msg.id, msg])).values()
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`Fetched ${uniqueMessages.length} SMS messages`);

    return new Response(
      JSON.stringify({
        messages: uniqueMessages,
        meta: {
          total: uniqueMessages.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-twilio-sms:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});