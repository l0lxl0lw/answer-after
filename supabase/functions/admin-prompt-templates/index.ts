import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  PLACEHOLDER_DEFINITIONS,
  buildPlaceholderValues,
  replacePlaceholders,
} from "../_shared/placeholder-utils.ts";

const logger = createLogger('admin-prompt-templates');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const supabaseAdmin = createServiceClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET: List all templates OR get placeholders
    if (req.method === 'GET') {
      // GET ?action=placeholders - Return available placeholder definitions
      if (action === 'placeholders') {
        return successResponse({
          success: true,
          data: PLACEHOLDER_DEFINITIONS,
        });
      }

      // Default GET - List all templates
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

    // POST: Update a template OR preview a template
    if (req.method === 'POST') {
      const body = await req.json();

      // POST with action=preview - Preview template with real org data
      if (body.action === 'preview') {
        const { template, institutionId } = body;

        if (!template) {
          return errorResponse('Template content is required', 400);
        }

        if (!institutionId) {
          return errorResponse('Organization ID is required for preview', 400);
        }

        // Fetch organization data
        const { data: org, error: orgError } = await supabaseAdmin
          .from('accounts')
          .select('id, name, timezone, business_hours_start, business_hours_end, business_hours_schedule')
          .eq('id', institutionId)
          .single();

        if (orgError) {
          logger.error('Error fetching organization for preview', orgError);
          return errorResponse('Organization not found', 404);
        }

        // Fetch services
        const { data: services } = await supabaseAdmin
          .from('services')
          .select('name, price_cents, duration_minutes')
          .eq('account_id', institutionId)
          .eq('is_active', true);

        // Fetch agent context
        const { data: agent } = await supabaseAdmin
          .from('account_agents')
          .select('context')
          .eq('account_id', institutionId)
          .maybeSingle();

        // Build placeholder values and render
        const placeholderValues = buildPlaceholderValues(org, services || [], agent);
        const rendered = replacePlaceholders(template, placeholderValues);

        return successResponse({
          success: true,
          rendered,
          placeholderValues,
          organization: { id: org.id, name: org.name },
        });
      }

      // Default POST - Update a template (requires id)
      if (!body.id) {
        return errorResponse('Template ID is required for update', 400);
      }

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
