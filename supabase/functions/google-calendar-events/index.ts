import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('google-calendar-events');

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

async function validateUserOrganization(req: Request, organizationId: string): Promise<{ valid: boolean; error?: string; userId?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { valid: false, error: "Missing authorization header" };
  }

  const supabase = createAnonClient();
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { valid: false, error: "Invalid authentication" };
  }

  const serviceSupabase = createServiceClient();
  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { valid: false, error: "User profile not found" };
  }

  if (profile.organization_id !== organizationId) {
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

async function getSelectedCalendarId(supabase: any, organizationId: string): Promise<string> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("selected_calendars")
    .eq("organization_id", organizationId)
    .single();

  if (!connection?.selected_calendars?.length) {
    return "primary";
  }

  return connection.selected_calendars[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await parseJsonBody<{
      action: string;
      organizationId?: string;
      timeMin?: string;
      timeMax?: string;
    }>(req, ['action']);

    const { action, organizationId, timeMin, timeMax } = body;

    const supabase = createServiceClient();

    switch (action) {
      case "list": {
        if (!organizationId) {
          return errorResponse("Organization ID required", 400);
        }

        // SECURITY: Validate user belongs to this organization
        const validation = await validateUserOrganization(req, organizationId);
        if (!validation.valid) {
          log.warn("Organization validation failed", { error: validation.error });
          return errorResponse(validation.error!, 403);
        }

        log.info("User validated for organization", { organizationId });

        const accessToken = await getValidAccessToken(supabase, organizationId);
        if (!accessToken) {
          return successResponse({ error: "No valid Google connection", events: [] });
        }

        const calendarId = await getSelectedCalendarId(supabase, organizationId);

        const params = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
        });

        if (timeMin) params.set("timeMin", timeMin);
        if (timeMax) params.set("timeMax", timeMax);

        const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

        log.info("Fetching events", { calendarId });

        const eventsResponse = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!eventsResponse.ok) {
          const errorText = await eventsResponse.text();
          log.error("Failed to fetch events", new Error(errorText));
          return successResponse({ error: "Failed to fetch events", events: [] });
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

        log.info("Events fetched", { count: events.length });

        return successResponse({ events });
      }

      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
