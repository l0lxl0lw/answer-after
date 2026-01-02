/**
 * Agent Lookup Contact Endpoint
 *
 * Called by ElevenLabs agent during live calls to identify returning customers.
 * Organization ID is baked into the webhook config for security isolation.
 */

import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('agent-lookup-contact');

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await req.json();
    const { organization_id, phone } = body;

    log.info("Lookup contact request", { organization_id, phone });

    // SECURITY: organization_id comes from webhook config, not agent input
    if (!organization_id) {
      log.warn("Missing organization_id in request");
      return errorResponse("Missing organization_id", 400);
    }

    if (!phone) {
      log.warn("Missing phone number");
      return errorResponse("Phone number is required", 400);
    }

    const supabase = createServiceClient();

    // Normalize phone for lookup - try multiple formats
    const phoneVariants = getPhoneVariants(phone);

    // Query ONLY this organization's contacts
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, phone, address, email, notes, status, created_at')
      .eq('organization_id', organization_id)
      .in('phone', phoneVariants)
      .single();

    if (contactError && contactError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error for lookup)
      log.error("Database error during lookup", contactError);
      return errorResponse("Failed to lookup contact", 500);
    }

    if (contact) {
      log.info("Contact found", { contactId: contact.id, name: contact.name });

      // Build a friendly message for the agent
      const greeting = contact.name
        ? `This is ${contact.name}, a returning customer.`
        : "This is a returning customer.";

      const details: string[] = [];
      if (contact.address) details.push(`Address on file: ${contact.address}`);
      if (contact.email) details.push(`Email: ${contact.email}`);
      if (contact.notes) details.push(`Notes: ${contact.notes}`);

      return successResponse({
        found: true,
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          address: contact.address,
          email: contact.email,
          notes: contact.notes,
        },
        message: greeting,
        details: details.length > 0 ? details.join('. ') : null,
      });
    }

    log.info("Contact not found", { phone });

    return successResponse({
      found: false,
      contact: null,
      message: "This appears to be a new caller. We don't have their information on file yet.",
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});

/**
 * Generate phone number variants for flexible matching
 * Handles cases where phone might be stored in different formats
 */
function getPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [phone]; // Original

  if (digits.length === 10) {
    // US number without country code
    variants.push(`+1${digits}`);
    variants.push(`1${digits}`);
    variants.push(digits);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    variants.push(`+${digits}`);
    variants.push(digits);
    variants.push(digits.slice(1)); // Without country code
    variants.push(`+1${digits.slice(1)}`);
  }

  // Remove duplicates
  return [...new Set(variants)];
}
