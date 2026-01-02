/**
 * Agent Save Contact Endpoint
 *
 * Called by ElevenLabs agent during live calls to save customer contact information.
 * Institution ID is baked into the webhook config for security isolation.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('agent-save-contact');

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await req.json();
    const { institution_id, phone, name, address, email, notes } = body;

    log.info("Save contact request", { institution_id, phone, hasName: !!name });

    // SECURITY: institution_id comes from webhook config, not agent input
    if (!institution_id) {
      log.warn("Missing institution_id in request");
      return errorResponse("Missing institution_id", 400);
    }

    if (!phone) {
      log.warn("Missing phone number");
      return errorResponse("Phone number is required", 400);
    }

    const supabase = createServiceClient();

    // Validate organization exists
    const { data: org, error: orgError } = await supabase
      .from('institutions')
      .select('id, name')
      .eq('id', institution_id)
      .single();

    if (orgError || !org) {
      log.warn("Invalid organization", { institution_id });
      return errorResponse("Invalid organization", 403);
    }

    // Normalize phone number (remove non-digits, ensure +1 prefix)
    const normalizedPhone = normalizePhone(phone);

    // Upsert contact - ALWAYS filtered by institution_id
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .upsert({
        institution_id,
        phone: normalizedPhone,
        name: name || null,
        address: address || null,
        email: email || null,
        notes: notes || null,
        status: 'customer',
        source: 'inbound_call',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'institution_id,phone',
        ignoreDuplicates: false
      })
      .select('id, name, phone')
      .single();

    if (contactError) {
      log.error("Failed to save contact", contactError);
      return errorResponse("Failed to save contact", 500);
    }

    log.info("Contact saved successfully", { contactId: contact.id, name: contact.name });

    // Return message the agent can speak to the customer
    const displayName = name || normalizedPhone;
    return successResponse({
      success: true,
      contact_id: contact.id,
      message: `Contact information for ${displayName} has been saved.`
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});

/**
 * Normalize phone number to consistent format
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Otherwise return as-is with + prefix if not present
  return phone.startsWith('+') ? phone : `+${digits}`;
}
