import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { type, email, phone, code, userId } = body;

    logStep('Verification request', { type, email, phone: phone ? '***' + phone.slice(-4) : null });

    if (!type || !['email', 'phone'].includes(type)) {
      throw new Error('Invalid verification type');
    }

    if (!code || code.length !== 6) {
      throw new Error('Invalid verification code');
    }

    // Build the query to find the verification code
    let query = supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('type', type)
      .eq('code', code)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (type === 'email' && email) {
      query = query.eq('email', email);
    } else if (type === 'phone' && phone) {
      query = query.eq('phone', phone);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: verificationCodes, error: fetchError } = await query;

    if (fetchError) {
      logStep('Error fetching verification code', { error: fetchError });
      throw new Error('Failed to verify code');
    }

    if (!verificationCodes || verificationCodes.length === 0) {
      logStep('Invalid or expired code');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const verification = verificationCodes[0];

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from('verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      logStep('Error updating verification', { error: updateError });
      throw new Error('Failed to mark code as verified');
    }

    // If we have a userId, update their profile
    const targetUserId = userId || verification.user_id;
    if (targetUserId) {
      const updateData: { email_verified?: boolean; phone_verified?: boolean; phone?: string } = {};
      
      if (type === 'email') {
        updateData.email_verified = true;
      } else if (type === 'phone') {
        updateData.phone_verified = true;
        if (phone) {
          updateData.phone = phone;
        }
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', targetUserId);

      if (profileError) {
        logStep('Error updating profile', { error: profileError });
        // Don't fail the whole request, just log it
      } else {
        logStep('Profile updated', { userId: targetUserId, type });
      }
    }

    logStep('Verification successful', { type, verificationId: verification.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully`,
        verified: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});