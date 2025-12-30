import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('admin-prompt-templates');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseAdmin = createServiceClient();

    // GET: List all templates
    if (req.method === 'GET') {
      const { data: templates, error } = await supabaseAdmin
        .from('prompt_templates')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching prompt templates', error);
        throw error;
      }

      return successResponse({ success: true, data: templates || [] });
    }

    // POST: Update a template
    if (req.method === 'POST') {
      const body = await parseJsonBody<{
        id: string;
        template?: string;
        description?: string;
        is_active?: boolean;
      }>(req, ['id']);

      const { id, template, description, is_active } = body;

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
        logger.error('Error updating prompt template', error);
        throw error;
      }

      return successResponse({ success: true, data });
    }

    // PUT: Create a new template
    if (req.method === 'PUT') {
      const body = await parseJsonBody<{
        name: string;
        template: string;
        description?: string;
      }>(req, ['name', 'template']);

      const { name, template, description } = body;

      const { data, error } = await supabaseAdmin
        .from('prompt_templates')
        .insert({ name, template, description, is_active: true })
        .select()
        .single();

      if (error) {
        logger.error('Error creating prompt template', error);
        throw error;
      }

      return successResponse({ success: true, data });
    }

    return errorResponse(`Unsupported method: ${req.method}`, 405);

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
