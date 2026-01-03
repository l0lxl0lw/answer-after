import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface WebhookPayload {
  action: 'create_contact' | 'update_contact' | 'trigger_call';
  data: Record<string, unknown>;
}

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      return null;
    }
  }
  if (cleaned.length < 9 || cleaned.length > 16) {
    return null;
  }
  return cleaned;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get webhook secret from header
    const webhookSecret = req.headers.get('X-Webhook-Secret');
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Webhook-Secret header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find account by webhook secret
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, webhook_enabled')
      .eq('webhook_secret', webhookSecret)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!account.webhook_enabled) {
      return new Response(
        JSON.stringify({ error: 'Webhooks are disabled for this account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: WebhookPayload = await req.json();

    if (!payload.action || !payload.data) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: action and data are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: Record<string, unknown> = {};

    switch (payload.action) {
      case 'create_contact': {
        const { phone, name, email, address, notes } = payload.data as Record<string, string>;

        if (!phone) {
          return new Response(
            JSON.stringify({ error: 'Phone is required for create_contact' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          return new Response(
            JSON.stringify({ error: 'Invalid phone number format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing contact
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('account_id', account.id)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: 'Contact already exists', contact_id: existing.id }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: contact, error: createError } = await supabase
          .from('contacts')
          .insert({
            account_id: account.id,
            phone: normalizedPhone,
            name: name || null,
            email: email || null,
            address: address || null,
            notes: notes || null,
            source: 'webhook',
            status: 'lead',
          })
          .select()
          .single();

        if (createError) throw createError;
        result = { success: true, contact_id: contact.id, action: 'created' };
        break;
      }

      case 'update_contact': {
        const { phone, updates } = payload.data as { phone: string; updates: Record<string, unknown> };

        if (!phone) {
          return new Response(
            JSON.stringify({ error: 'Phone is required for update_contact' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          return new Response(
            JSON.stringify({ error: 'Invalid phone number format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find contact
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('account_id', account.id)
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (!contact) {
          return new Response(
            JSON.stringify({ error: 'Contact not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Filter allowed update fields
        const allowedFields = ['name', 'email', 'address', 'notes', 'status'];
        const safeUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates || {})) {
          if (allowedFields.includes(key)) {
            safeUpdates[key] = value;
          }
        }

        if (Object.keys(safeUpdates).length === 0) {
          return new Response(
            JSON.stringify({ error: 'No valid fields to update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('contacts')
          .update({ ...safeUpdates, updated_at: new Date().toISOString() })
          .eq('id', contact.id);

        if (updateError) throw updateError;
        result = { success: true, contact_id: contact.id, action: 'updated' };
        break;
      }

      case 'trigger_call': {
        const { phone, campaign_id } = payload.data as { phone: string; campaign_id?: string };

        if (!phone) {
          return new Response(
            JSON.stringify({ error: 'Phone is required for trigger_call' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Note: Actual call triggering would integrate with Twilio/ElevenLabs
        // This is a placeholder that acknowledges the request
        result = {
          success: true,
          message: 'Call trigger received',
          phone,
          campaign_id: campaign_id || null,
          status: 'queued',
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${payload.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
