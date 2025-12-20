import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client to get user info
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's profile to find organization and signup time
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, created_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error("Profile error:", profileError);
      return new Response(JSON.stringify({ error: "User not in organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization's phone numbers
    const { data: phoneNumbers, error: phoneError } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("organization_id", profile.organization_id);

    if (phoneError) {
      console.error("Phone numbers error:", phoneError);
      return new Response(JSON.stringify({ error: "Failed to get phone numbers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNumbers = phoneNumbers?.map(p => p.phone_number) || [];
    console.log("Fetching calls for phone numbers:", toNumbers);
    console.log("User signed up at:", profile.created_at);

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      console.error("Missing Twilio credentials");
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      // Build Twilio API URL with filters
      const twilioUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`);
      twilioUrl.searchParams.set("To", toNumber);
      twilioUrl.searchParams.set("StartTime>", signupDate.toISOString().split("T")[0]);
      twilioUrl.searchParams.set("PageSize", "100");

      console.log("Fetching from Twilio:", twilioUrl.toString());

      const response = await fetch(twilioUrl.toString(), {
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twilio API error:", response.status, errorText);
        continue;
      }

      const data = await response.json();
      console.log(`Found ${data.calls?.length || 0} calls for ${toNumber}`);

      // Transform Twilio calls to our format
      for (const call of data.calls || []) {
        const twilioCall = call as TwilioCall;
        
        // Map Twilio status to our status
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
    }

    // Sort by started_at descending
    allCalls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    // Apply search filter if provided
    let filteredCalls = allCalls;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCalls = allCalls.filter(call =>
        call.caller_phone.toLowerCase().includes(searchLower) ||
        (call.caller_name?.toLowerCase().includes(searchLower)) ||
        (call.summary?.toLowerCase().includes(searchLower))
      );
    }

    // Paginate results
    const total = filteredCalls.length;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedCalls = filteredCalls.slice(startIndex, endIndex);

    console.log(`Returning ${paginatedCalls.length} calls (page ${page}, total ${total})`);

    return new Response(
      JSON.stringify({
        calls: paginatedCalls,
        meta: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching Twilio calls:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
