import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all organizations with related data
    const { data: organizations, error } = await supabaseAdmin
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        created_at,
        is_onboarding_complete,
        phone_numbers(phone_number),
        subscriptions(plan, status, stripe_subscription_id),
        organization_agents(elevenlabs_agent_id),
        profiles(email, full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching organizations:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, data: organizations || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' && error !== null && 'message' in error) 
        ? String((error as { message: unknown }).message) 
        : String(error);
    console.error('Error in admin-list-organizations:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
