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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Helper function to validate user belongs to organization
async function validateUserOrganization(req: Request, organizationId: string): Promise<{ valid: boolean; error?: string; userId?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { valid: false, error: "Missing authorization header" };
  }

  // Create client with user's token to validate their identity
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("Failed to get user:", userError);
    return { valid: false, error: "Invalid authentication" };
  }

  // Use service role to check user's organization
  const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Failed to get user profile:", profileError);
    return { valid: false, error: "User profile not found" };
  }

  if (profile.organization_id !== organizationId) {
    console.error("User organization mismatch:", { userOrg: profile.organization_id, requestedOrg: organizationId });
    return { valid: false, error: "Unauthorized - user does not belong to this organization" };
  }

  return { valid: true, userId: user.id };
}

async function getValidAccessToken(supabase: any, organizationId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (error || !connection) {
    console.error("No Google connection found for org:", organizationId);
    return null;
  }

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  
  if (now >= expiresAt) {
    console.log("Token expired, refreshing...");
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

async function getSelectedCalendarId(supabase: any, organizationId: string): Promise<string | null> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("selected_calendars")
    .eq("organization_id", organizationId)
    .single();

  if (!connection?.selected_calendars?.length) {
    return "primary"; // Default to primary calendar
  }

  return connection.selected_calendars[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, organizationId, timeMin, timeMax } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case "list": {
        if (!organizationId) {
          return new Response(JSON.stringify({ error: "Organization ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // SECURITY: Validate user belongs to this organization
        const validation = await validateUserOrganization(req, organizationId);
        if (!validation.valid) {
          console.error("Organization validation failed:", validation.error);
          return new Response(JSON.stringify({ error: validation.error, events: [] }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("User validated for organization:", organizationId);

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "No valid Google connection", events: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const calendarId = await getSelectedCalendarId(supabase, organizationId);
        
        // Build query params
        const params = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        });

        if (timeMin) params.set("timeMin", timeMin);
        if (timeMax) params.set("timeMax", timeMax);

        const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId!)}/events?${params}`;
        
        console.log("Fetching events from:", eventsUrl);

        const eventsResponse = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!eventsResponse.ok) {
          const errorText = await eventsResponse.text();
          console.error("Failed to fetch events:", errorText);
          return new Response(JSON.stringify({ error: "Failed to fetch events", events: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const eventsData = await eventsResponse.json();
        
        // Transform events to simpler format
        const events = (eventsData.items || []).map((event: any) => ({
          id: event.id,
          summary: event.summary || "Untitled",
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          colorId: event.colorId,
          description: event.description,
          location: event.location,
        }));

        console.log(`Found ${events.length} events`);

        return new Response(JSON.stringify({ events }), {
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
    console.error("Google Calendar Events error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message, events: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
