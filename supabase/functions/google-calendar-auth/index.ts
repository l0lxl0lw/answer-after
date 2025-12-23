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

// Scopes for calendar and contacts access
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/contacts",
].join(" ");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, redirectUrl, code, organizationId, accessToken, refreshToken, expiresIn, email, calendarId } = body;

    // Create supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case "authorize": {
        // Build OAuth URL for Google Calendar
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUrl,
          response_type: "code",
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
        });
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        console.log("Generated auth URL for redirect:", redirectUrl);
        
        return new Response(JSON.stringify({ authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "callback": {
        // Exchange code for tokens
        console.log("Exchanging code for tokens...");
        
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUrl,
          }),
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
          console.error("Token exchange failed:", tokenData);
          return new Response(JSON.stringify({ error: tokenData.error_description || "Token exchange failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get user's email from Google
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        
        console.log("Successfully obtained tokens for:", userInfo.email);

        return new Response(JSON.stringify({
          success: true,
          email: userInfo.email,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list-calendars": {
        // Get the authorization header to identify the user
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (!accessToken) {
          return new Response(JSON.stringify({ error: "Access token required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch calendars from Google
        const calendarsResponse = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        const calendarsData = await calendarsResponse.json();
        
        if (calendarsData.error) {
          console.error("Failed to fetch calendars:", calendarsData.error);
          return new Response(JSON.stringify({ error: "Failed to fetch calendars" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Filter to calendars user can write to
        const writableCalendars = calendarsData.items?.filter(
          (cal: any) => cal.accessRole === "owner" || cal.accessRole === "writer"
        ) || [];

        return new Response(JSON.stringify({ calendars: writableCalendars }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "save-connection": {
        // Save the calendar connection to database
        if (!organizationId || !accessToken || !refreshToken || !calendarId) {
          console.error("Missing fields:", { organizationId: !!organizationId, accessToken: !!accessToken, refreshToken: !!refreshToken, calendarId: !!calendarId });
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString();

        // Upsert the connection (one per organization)
        const { error } = await supabase
          .from("google_calendar_connections")
          .upsert({
            organization_id: organizationId,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: expiresAt,
            connected_email: email,
            selected_calendars: [calendarId],
            connected_at: new Date().toISOString(),
          }, { onConflict: "organization_id" });

        if (error) {
          console.error("Failed to save connection:", error);
          return new Response(JSON.stringify({ error: "Failed to save connection" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Calendar connection saved for org:", organizationId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "refresh-token": {
        // Refresh an expired access token
        if (!refreshToken) {
          return new Response(JSON.stringify({ error: "Refresh token required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        const refreshData = await refreshResponse.json();
        
        if (refreshData.error) {
          console.error("Token refresh failed:", refreshData);
          return new Response(JSON.stringify({ error: "Token refresh failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          accessToken: refreshData.access_token,
          expiresIn: refreshData.expires_in,
        }), {
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
    console.error("Google Calendar auth error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
