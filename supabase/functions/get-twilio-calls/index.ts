import { createAnonClient, createServiceClient, createUserClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getTwilioCredentials, makeTwilioRequest, getAccountUrl, getSubaccount, isLocalSubaccountMode, getLocalSubaccountConfig } from "../_shared/twilio.ts";

const logger = createLogger('get-twilio-calls');

interface TwilioCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration: string;
  start_time: string;
  end_time: string;
  date_created: string;
}

interface TransformedCall {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  status: string;
  outcome: string | null;
  is_emergency: boolean;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  summary: string | null;
  twilio_call_sid: string;
}

Deno.serve(async (req) => {
  const log = logger.withContext({ requestId: crypto.randomUUID() });
  log.info("Request received", { method: req.method });

  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log.warn("No authorization header");
      return errorResponse("No authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // Create client with user's JWT for RLS-protected queries
    const supabase = createUserClient(token);

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      log.warn("Unauthorized", { error: userError?.message });
      return errorResponse("Unauthorized", 401);
    }

    log.info("User authenticated", { userId: user.id });

    // Get user's profile to find organization and signup time
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("account_id, created_at")
      .eq("id", user.id)
      .single();

    log.info("Profile lookup", { profile, error: profileError?.message });

    if (!profile?.account_id) {
      log.warn("User not in organization", { userId: user.id, profile });
      return errorResponse("User not in organization", 400);
    }

    // Get institution details including subaccount
    const supabaseAdmin = createServiceClient();
    const { data: org, error: orgError } = await supabaseAdmin
      .from("accounts")
      .select("twilio_subaccount_sid")
      .eq("id", profile.account_id)
      .single();

    if (orgError) {
      log.warn("Failed to get organization", { error: orgError });
      return errorResponse("Failed to get organization", 500);
    }

    // Get organization's phone numbers
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("account_id", profile.account_id);

    if (phoneError) {
      return errorResponse("Failed to get phone numbers", 500);
    }

    const toNumbers = phoneNumbers?.map(p => p.phone_number) || [];
    log.info("Fetching calls for phone numbers", { count: toNumbers.length, subaccountSid: org?.twilio_subaccount_sid });

    // If no phone numbers, return empty list
    if (toNumbers.length === 0) {
      return successResponse({
        calls: [],
        meta: { page: 1, per_page: 20, total: 0, total_pages: 0 },
      });
    }

    // Get Twilio credentials - use subaccount if available
    const masterCredentials = getTwilioCredentials();
    let twilioCredentials = masterCredentials;

    // Check if using local subaccount mode
    if (isLocalSubaccountMode()) {
      const localConfig = getLocalSubaccountConfig();
      if (localConfig.sid && localConfig.authToken) {
        twilioCredentials = { accountSid: localConfig.sid, authToken: localConfig.authToken };
        log.info("Using local subaccount credentials");
      }
    } else if (org?.twilio_subaccount_sid) {
      // Get subaccount auth token from Twilio
      try {
        const subaccount = await getSubaccount(org.twilio_subaccount_sid, masterCredentials);
        twilioCredentials = { accountSid: subaccount.sid, authToken: subaccount.authToken };
        log.info("Using organization subaccount credentials");
      } catch (e) {
        log.warn("Failed to get subaccount credentials, falling back to master", { error: String(e) });
      }
    }

    // Parse query parameters
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("per_page") || "20");

    // Fetch calls from Twilio for each phone number
    const allCalls: TransformedCall[] = [];
    const signupDate = new Date(profile.created_at);

    for (const toNumber of toNumbers) {
      try {
        const params = new URLSearchParams({
          To: toNumber,
          "StartTime>": signupDate.toISOString().split("T")[0],
          PageSize: "100",
        });

        const data = await makeTwilioRequest<{ calls: TwilioCall[] }>(
          `${getAccountUrl(twilioCredentials.accountSid)}/Calls.json?${params}`,
          { accountSid: twilioCredentials.accountSid, authToken: twilioCredentials.authToken }
        );

        log.info(`Found calls for ${toNumber}`, { count: data.calls?.length || 0 });

        // Transform Twilio calls to our format
        for (const twilioCall of data.calls || []) {
          let status = "completed";
          let outcome: string | null = null;

          switch (twilioCall.status) {
            case "completed":
              status = "completed";
              outcome = parseInt(twilioCall.duration) > 0 ? "information_provided" : "no_action";
              break;
            case "busy":
            case "no-answer":
            case "canceled":
              status = "failed";
              outcome = "no_action";
              break;
            case "failed":
              status = "failed";
              outcome = "no_action";
              break;
            case "in-progress":
            case "ringing":
            case "queued":
              status = "active";
              break;
            default:
              status = "completed";
          }

          allCalls.push({
            id: twilioCall.sid,
            caller_phone: twilioCall.from,
            caller_name: null,
            status,
            outcome,
            is_emergency: false,
            started_at: twilioCall.start_time || twilioCall.date_created,
            ended_at: twilioCall.end_time || null,
            duration_seconds: parseInt(twilioCall.duration) || 0,
            summary: `Call from ${twilioCall.from} - ${twilioCall.status}`,
            twilio_call_sid: twilioCall.sid,
          });
        }
      } catch (error) {
        log.warn(`Error fetching calls for ${toNumber}`, { error: (error as Error).message });
      }
    }

    // Sort by started_at descending
    allCalls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    // Apply search filter if provided
    let filteredCalls = allCalls;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCalls = allCalls.filter(call =>
        call.caller_phone.toLowerCase().includes(searchLower) ||
        call.caller_name?.toLowerCase().includes(searchLower) ||
        call.summary?.toLowerCase().includes(searchLower)
      );
    }

    // Paginate results
    const total = filteredCalls.length;
    const startIndex = (page - 1) * perPage;
    const paginatedCalls = filteredCalls.slice(startIndex, startIndex + perPage);

    log.info(`Returning calls`, { count: paginatedCalls.length, page, total });

    return successResponse({
      calls: paginatedCalls,
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });

  } catch (error) {
    logger.error("Handler error", error as Error);
    return errorResponse(error as Error);
  }
});
