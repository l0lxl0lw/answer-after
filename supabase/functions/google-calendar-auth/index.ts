import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAnonClient, createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const logger = createLogger('google-calendar-auth');

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/contacts",
].join(" ");

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const body = await parseJsonBody<{
      action: string;
      redirectUrl?: string;
      code?: string;
      organizationId?: string;
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      email?: string;
      calendarId?: string;
    }>(req, ['action']);

    const { action, redirectUrl, code, organizationId, accessToken, refreshToken, expiresIn, email, calendarId } = body;

    const supabase = createServiceClient();

    switch (action) {
      case "authorize": {
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUrl!,
          response_type: "code",
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        log.info("Generated auth URL", { redirectUrl });

        return successResponse({ authUrl });
      }

      case "callback": {
        log.step("Exchanging code for tokens");

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code!,
            grant_type: "authorization_code",
            redirect_uri: redirectUrl!,
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          log.error("Token exchange failed", new Error(tokenData.error_description));
          return errorResponse(tokenData.error_description || "Token exchange failed", 400);
        }

        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        log.info("Successfully obtained tokens", { email: userInfo.email });

        return successResponse({
          success: true,
          email: userInfo.email,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        });
      }

      case "list-calendars": {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
          return errorResponse("Unauthorized", 401);
        }

        if (!accessToken) {
          return errorResponse("Access token required", 400);
        }

        const calendarsResponse = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const calendarsData = await calendarsResponse.json();

        if (calendarsData.error) {
          log.error("Failed to fetch calendars", new Error(calendarsData.error.message));
          return errorResponse("Failed to fetch calendars", 400);
        }

        const writableCalendars = calendarsData.items?.filter(
          (cal: any) => cal.accessRole === "owner" || cal.accessRole === "writer"
        ) || [];

        return successResponse({ calendars: writableCalendars });
      }

      case "save-connection": {
        if (!organizationId || !accessToken || !refreshToken || !calendarId) {
          return errorResponse("Missing required fields", 400);
        }

        const validation = await validateUserOrganization(req, organizationId);
        if (!validation.valid) {
          return errorResponse(validation.error!, 403);
        }

        log.info("User validated for organization", { organizationId });

        const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString();

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
          log.error("Failed to save connection", error);
          return errorResponse("Failed to save connection", 500);
        }

        log.info("Calendar connection saved", { organizationId });

        return successResponse({ success: true });
      }

      case "refresh-token": {
        if (!refreshToken) {
          return errorResponse("Refresh token required", 400);
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
          log.error("Token refresh failed", new Error(refreshData.error));
          return errorResponse("Token refresh failed", 400);
        }

        return successResponse({
          accessToken: refreshData.access_token,
          expiresIn: refreshData.expires_in,
        });
      }

      default:
        return errorResponse("Unknown action", 400);
    }

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
