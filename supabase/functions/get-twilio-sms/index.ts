import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('get-twilio-sms');

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
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    const anonClient = createAnonClient();
    const supabase = createServiceClient();

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('No authorization header', 401);
    }

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      log.error('Auth error', authError || new Error('No user'));
      return errorResponse('Unauthorized', 401);
    }

    // Get user's organization using service role client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      log.error('Profile error', profileError || new Error('No organization'));
      return errorResponse('User organization not found', 404);
    }

    // Get organization's phone numbers
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true);

    if (phoneError) {
      log.error('Phone numbers error', phoneError);
      return errorResponse('Failed to fetch phone numbers', 500);
    }

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return successResponse({ messages: [], meta: { total: 0 } });
    }

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioAccountSid || !twilioAuthToken) {
      log.error('Missing Twilio credentials', new Error('Credentials not configured'));
      return errorResponse('Twilio credentials not configured', 500);
    }

    // Fetch SMS messages from Twilio for each phone number
    const allMessages: TransformedMessage[] = [];
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    for (const { phone_number } of phoneNumbers) {
      const inboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(phone_number)}&PageSize=50`;
      const outboundUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?From=${encodeURIComponent(phone_number)}&PageSize=50`;

      try {
        // Fetch inbound messages
        const inboundResponse = await fetch(inboundUrl, {
          headers: { 'Authorization': `Basic ${credentials}` },
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
          headers: { 'Authorization': `Basic ${credentials}` },
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
        log.error(`Error fetching SMS for ${phone_number}`, fetchError as Error);
      }
    }

    // Remove duplicates based on message ID and sort by date
    const uniqueMessages = Array.from(
      new Map(allMessages.map(msg => [msg.id, msg])).values()
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    log.info('Fetched SMS messages', { count: uniqueMessages.length });

    return successResponse({
      messages: uniqueMessages,
      meta: { total: uniqueMessages.length },
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse('Internal server error', 500);
  }
});
