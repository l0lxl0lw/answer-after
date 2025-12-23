import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SOURCE_TAG = "AnswerAfter";

async function getValidAccessToken(supabase: any, organizationId: string): Promise<string | null> {
  // Get the stored connection
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !connection) {
    console.error("No Google connection found for org:", organizationId);
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  
  if (now >= expiresAt) {
    console.log("Token expired, refreshing...");
    // Refresh the token
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
      console.error("Token refresh failed:", refreshData);
      return null;
    }

    // Update the stored token
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, organizationId, name, phone, notes, resourceName } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case "list": {
        // List contacts with AnswerAfter tag
        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "No valid Google connection" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Search for contacts with our source tag
        const searchUrl = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(SOURCE_TAG)}&readMask=names,phoneNumbers,biographies,metadata&sources=READ_SOURCE_TYPE_CONTACT&pageSize=100`;
        
        const searchResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!searchResponse.ok) {
          console.error("Search failed:", await searchResponse.text());
          // Fallback to listing all contacts
          const listUrl = `https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,biographies,metadata&pageSize=200`;
          const listResponse = await fetch(listUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!listResponse.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch contacts" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const listData = await listResponse.json();
          // Filter by source tag in biographies
          const contacts = (listData.connections || []).filter((contact: any) => {
            const bio = contact.biographies?.[0]?.value || "";
            return bio.includes(`Source: ${SOURCE_TAG}`);
          });

          return new Response(JSON.stringify({ contacts }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const searchData = await searchResponse.json();
        const contacts = searchData.results?.map((r: any) => r.person) || [];

        return new Response(JSON.stringify({ contacts }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        // Create a new contact
        if (!name || !phone) {
          return new Response(JSON.stringify({ error: "Name and phone are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "No valid Google connection" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create contact with AnswerAfter source tag
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
          console.error("Create contact failed:", errorText);
          return new Response(JSON.stringify({ error: "Failed to create contact" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const createdContact = await createResponse.json();
        console.log("Contact created:", createdContact.resourceName);

        return new Response(JSON.stringify({ success: true, contact: createdContact }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        // Update an existing contact
        if (!resourceName) {
          return new Response(JSON.stringify({ error: "Resource name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "No valid Google connection" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // First get the current contact to get etag
        const getResponse = await fetch(
          `https://people.googleapis.com/v1/${resourceName}?personFields=names,phoneNumbers,biographies,metadata`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!getResponse.ok) {
          return new Response(JSON.stringify({ error: "Contact not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
          console.error("Update contact failed:", errorText);
          return new Response(JSON.stringify({ error: "Failed to update contact" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updatedContact = await updateResponse.json();
        console.log("Contact updated:", resourceName);

        return new Response(JSON.stringify({ success: true, contact: updatedContact }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        // Delete a contact
        if (!resourceName) {
          return new Response(JSON.stringify({ error: "Resource name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "No valid Google connection" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
          console.error("Delete contact failed:", errorText);
          return new Response(JSON.stringify({ error: "Failed to delete contact" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Contact deleted:", resourceName);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Google Contacts error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
