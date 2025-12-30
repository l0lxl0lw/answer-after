import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('google-contacts');

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SOURCE_TAG = "AnswerAfter";

async function getValidAccessToken(supabase: any, organizationId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !connection) {
    return null;
  }

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();

  if (now >= expiresAt) {
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      return null;
    }

    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshData.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("organization_id", organizationId);

    return refreshData.access_token;
  }

  return connection.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await parseJsonBody<{
      action: string;
      organizationId: string;
      name?: string;
      phone?: string;
      notes?: string;
      resourceName?: string;
    }>(req, ['action', 'organizationId']);

    const { action, organizationId, name, phone, notes, resourceName } = body;

    const supabase = createServiceClient();

    switch (action) {
      case "list": {
        log.info("Listing contacts", { organizationId });

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return errorResponse("No valid Google connection", 400);
        }

        const listUrl = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,biographies,metadata&pageSize=1000&sortOrder=LAST_MODIFIED_DESCENDING`;

        const listResponse = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          log.error("List contacts failed", new Error(errorText));
          return errorResponse("Failed to fetch contacts", 400);
        }

        const listData = await listResponse.json();

        // Filter by source tag in biographies
        const contacts = (listData.connections || []).filter((contact: any) => {
          const bio = contact.biographies?.[0]?.value || "";
          return bio.includes(`Source: ${SOURCE_TAG}`);
        });

        log.info("Contacts filtered", { total: listData.connections?.length || 0, filtered: contacts.length });

        return successResponse({ contacts });
      }

      case "create": {
        if (!name || !phone) {
          return errorResponse("Name and phone are required", 400);
        }

        log.info("Creating contact", { organizationId, name });

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return errorResponse("No valid Google connection", 400);
        }

        const contactData = {
          names: [{ givenName: name }],
          phoneNumbers: [{ value: phone, type: "mobile" }],
          biographies: [{
            value: `Source: ${SOURCE_TAG}${notes ? `\n${notes}` : ""}`,
            contentType: "TEXT_PLAIN"
          }],
        };

        const createResponse = await fetch(
          "https://people.googleapis.com/v1/people:createContact?personFields=names,phoneNumbers,biographies",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(contactData),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          log.error("Create contact failed", new Error(errorText));
          return errorResponse("Failed to create contact", 400);
        }

        const createdContact = await createResponse.json();
        log.info("Contact created", { resourceName: createdContact.resourceName });

        return successResponse({ success: true, contact: createdContact });
      }

      case "update": {
        if (!resourceName) {
          return errorResponse("Resource name is required", 400);
        }

        log.info("Updating contact", { organizationId, resourceName });

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return errorResponse("No valid Google connection", 400);
        }

        // First get the current contact to get etag
        const getResponse = await fetch(
          `https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,biographies,metadata`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!getResponse.ok) {
          return errorResponse("Contact not found", 404);
        }

        const existingContact = await getResponse.json();
        const etag = existingContact.etag;

        // Build update data
        const updateData: any = { etag };
        const updateMask: string[] = [];

        if (name) {
          updateData.names = [{ givenName: name }];
          updateMask.push("names");
        }
        if (phone) {
          updateData.phoneNumbers = [{ value: phone, type: "mobile" }];
          updateMask.push("phoneNumbers");
        }
        if (notes !== undefined) {
          updateData.biographies = [{
            value: `Source: ${SOURCE_TAG}${notes ? `\n${notes}` : ""}`,
            contentType: "TEXT_PLAIN"
          }];
          updateMask.push("biographies");
        }

        const updateResponse = await fetch(
          `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=${updateMask.join(",")}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          log.error("Update contact failed", new Error(errorText));
          return errorResponse("Failed to update contact", 400);
        }

        const updatedContact = await updateResponse.json();
        log.info("Contact updated", { resourceName });

        return successResponse({ success: true, contact: updatedContact });
      }

      case "delete": {
        if (!resourceName) {
          return errorResponse("Resource name is required", 400);
        }

        log.info("Deleting contact", { organizationId, resourceName });

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return errorResponse("No valid Google connection", 400);
        }

        const deleteResponse = await fetch(
          `https://people.googleapis.com/v1/${resourceName}:deleteContact`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          log.error("Delete contact failed", new Error(errorText));
          return errorResponse("Failed to delete contact", 400);
        }

        log.info("Contact deleted", { resourceName });

        return successResponse({ success: true });
      }

      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
