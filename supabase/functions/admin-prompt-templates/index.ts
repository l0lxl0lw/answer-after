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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // GET: List all templates
    if (req.method === 'GET') {
      const { data: templates, error } = await supabaseAdmin
        .from('prompt_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching prompt templates:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data: templates || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Update a template
    if (req.method === 'POST') {
      const body = await req.json();
      const { id, template, description, is_active } = body;

      if (!id) {
        throw new Error('Template ID is required');
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (template !== undefined) updateData.template = template;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data, error } = await supabaseAdmin
        .from('prompt_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating prompt template:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT: Create a new template
    if (req.method === 'PUT') {
      const body = await req.json();
      const { name, template, description } = body;

      if (!name || !template) {
        throw new Error('Name and template are required');
      }

      const { data, error } = await supabaseAdmin
        .from('prompt_templates')
        .insert({ name, template, description, is_active: true })
        .select()
        .single();

      if (error) {
        console.error('Error creating prompt template:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unsupported method: ${req.method}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in admin-prompt-templates:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
