import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingRequest {
  organizationId: string;
  subscriptionPlan: string;
  areaCode?: string; // Optional preferred area code for phone number
}

interface OnboardingResult {
  success: boolean;
  steps: StepResult[];
  error?: string;
}

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ONBOARDING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const results: StepResult[] = [];

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { organizationId, subscriptionPlan, areaCode } = await req.json() as OnboardingRequest;

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    logStep('Starting onboarding', { organizationId, subscriptionPlan, areaCode });

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      throw new Error(`Organization not found: ${orgError?.message}`);
    }

    // ============================================
    // STEP 1: Create Twilio Subaccount
    // ============================================
    logStep('Step 1: Creating Twilio subaccount');
    
    let subaccountSid = org.twilio_subaccount_sid;
    let subaccountAuthToken = org.twilio_subaccount_auth_token;

    if (!subaccountSid) {
      const friendlyName = `AnswerAfter-${org.name.substring(0, 20)}-${organizationId.substring(0, 8)}`;
      
      const subaccountResponse = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts.json',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ FriendlyName: friendlyName })
        }
      );

      if (!subaccountResponse.ok) {
        const errorText = await subaccountResponse.text();
        logStep('Twilio subaccount creation failed', { error: errorText });
        results.push({
          step: 'create_twilio_subaccount',
          success: false,
          message: `Failed to create Twilio subaccount: ${errorText}`
        });
        throw new Error('Failed to create Twilio subaccount');
      }

      const subaccount = await subaccountResponse.json();
      subaccountSid = subaccount.sid;
      subaccountAuthToken = subaccount.auth_token;

      // Save to database
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          twilio_subaccount_sid: subaccountSid,
          twilio_subaccount_auth_token: subaccountAuthToken
        })
        .eq('id', organizationId);

      if (updateError) {
        logStep('Failed to save subaccount', { error: updateError });
      }

      logStep('Twilio subaccount created', { sid: subaccountSid });
      results.push({
        step: 'create_twilio_subaccount',
        success: true,
        message: 'Twilio subaccount created successfully',
        data: { subaccountSid }
      });
    } else {
      logStep('Twilio subaccount already exists', { sid: subaccountSid });
      results.push({
        step: 'create_twilio_subaccount',
        success: true,
        message: 'Twilio subaccount already exists',
        data: { subaccountSid }
      });
    }

    // ============================================
    // STEP 2: Search for Available Phone Numbers
    // ============================================
    logStep('Step 2: Searching for phone numbers');

    // Check if org already has a phone number
    const { data: existingPhones } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    let phoneNumber: string | null = null;
    let phoneTwilioSid: string | null = null;

    if (existingPhones && existingPhones.length > 0) {
      phoneNumber = existingPhones[0].phone_number;
      phoneTwilioSid = existingPhones[0].twilio_sid;
      logStep('Phone number already exists', { phoneNumber });
      results.push({
        step: 'search_phone_numbers',
        success: true,
        message: 'Phone number already provisioned',
        data: { phoneNumber }
      });
    } else {
      // Search for available numbers
      const searchParams = new URLSearchParams({
        VoiceEnabled: 'true',
        Limit: '5'
      });
      
      if (areaCode) {
        searchParams.set('AreaCode', areaCode);
      }

      const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/AvailablePhoneNumbers/US/Local.json?${searchParams}`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`
        }
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        logStep('Phone search failed', { error: errorText });
        results.push({
          step: 'search_phone_numbers',
          success: false,
          message: `Failed to search phone numbers: ${errorText}`
        });
        // Continue with other steps, phone can be added later
      } else {
        const searchResult = await searchResponse.json();
        
        if (!searchResult.available_phone_numbers || searchResult.available_phone_numbers.length === 0) {
          logStep('No phone numbers available');
          results.push({
            step: 'search_phone_numbers',
            success: false,
            message: 'No phone numbers available in the requested area'
          });
        } else {
          const availableNumber = searchResult.available_phone_numbers[0];
          logStep('Found available number', { number: availableNumber.phone_number });

          // ============================================
          // STEP 3: Purchase Phone Number
          // ============================================
          logStep('Step 3: Purchasing phone number');

          const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-webhook`;
          
          const purchaseResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${subaccountSid}:${subaccountAuthToken}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                PhoneNumber: availableNumber.phone_number,
                VoiceUrl: webhookUrl,
                VoiceMethod: 'POST'
              })
            }
          );

          if (!purchaseResponse.ok) {
            const errorText = await purchaseResponse.text();
            logStep('Phone purchase failed', { error: errorText });
            results.push({
              step: 'purchase_phone_number',
              success: false,
              message: `Failed to purchase phone number: ${errorText}`
            });
          } else {
            const purchasedNumber = await purchaseResponse.json();
            phoneNumber = purchasedNumber.phone_number;
            phoneTwilioSid = purchasedNumber.sid;

            logStep('Phone number purchased', { phoneNumber, sid: phoneTwilioSid });

            // Save to database
            const { error: phoneInsertError } = await supabase
              .from('phone_numbers')
              .insert({
                organization_id: organizationId,
                phone_number: phoneNumber,
                friendly_name: availableNumber.friendly_name || 'Business Line',
                is_shared: false,
                is_active: true,
                twilio_sid: phoneTwilioSid,
                provisioned_at: new Date().toISOString()
              });

            if (phoneInsertError) {
              logStep('Failed to save phone number', { error: phoneInsertError });
            }

            results.push({
              step: 'purchase_phone_number',
              success: true,
              message: 'Phone number purchased and configured',
              data: { phoneNumber, twilioSid: phoneTwilioSid }
            });
          }
        }
      }
    }

    // ============================================
    // STEP 4: Create ElevenLabs Agent
    // ============================================
    logStep('Step 4: Creating ElevenLabs agent');

    // Check if agent already exists
    const { data: agentRecord } = await supabase
      .from('organization_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (agentRecord?.elevenlabs_agent_id) {
      logStep('ElevenLabs agent already exists', { agentId: agentRecord.elevenlabs_agent_id });
      results.push({
        step: 'create_elevenlabs_agent',
        success: true,
        message: 'ElevenLabs agent already exists',
        data: { agentId: agentRecord.elevenlabs_agent_id }
      });
    } else {
      // Create agent via the elevenlabs-agent function
      const agentResponse = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'create-agent',
          organizationId: organizationId,
          context: agentRecord?.context || JSON.stringify({
            orgName: org.name,
            businessType: 'Service Business',
            services: [],
          })
        }),
      });

      const agentResult = await agentResponse.json();
      
      if (agentResult.success) {
        logStep('ElevenLabs agent created', { agentId: agentResult.agent_id });
        results.push({
          step: 'create_elevenlabs_agent',
          success: true,
          message: 'ElevenLabs agent created successfully',
          data: { agentId: agentResult.agent_id }
        });
      } else {
        logStep('ElevenLabs agent creation failed', { error: agentResult.error });
        results.push({
          step: 'create_elevenlabs_agent',
          success: false,
          message: `Failed to create ElevenLabs agent: ${agentResult.error}`
        });
      }
    }

    // ============================================
    // STEP 5: Finalize - Update subscription status
    // ============================================
    logStep('Step 5: Finalizing onboarding');

    const { error: subUpdateError } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'active',
        plan: subscriptionPlan || 'core'
      })
      .eq('organization_id', organizationId);

    if (subUpdateError) {
      logStep('Failed to update subscription', { error: subUpdateError });
      results.push({
        step: 'finalize_subscription',
        success: false,
        message: `Failed to update subscription: ${subUpdateError.message}`
      });
    } else {
      logStep('Subscription updated to active');
      results.push({
        step: 'finalize_subscription',
        success: true,
        message: 'Subscription activated successfully'
      });
    }

    // Calculate overall success
    const allSuccess = results.every(r => r.success);
    const criticalStepsSuccess = results
      .filter(r => ['create_twilio_subaccount', 'finalize_subscription'].includes(r.step))
      .every(r => r.success);

    logStep('Onboarding complete', { allSuccess, criticalStepsSuccess, steps: results.length });

    return new Response(
      JSON.stringify({
        success: criticalStepsSuccess,
        steps: results,
        summary: {
          subaccountCreated: results.find(r => r.step === 'create_twilio_subaccount')?.success,
          phoneProvisioned: results.find(r => r.step === 'purchase_phone_number')?.success,
          agentCreated: results.find(r => r.step === 'create_elevenlabs_agent')?.success,
          subscriptionActive: results.find(r => r.step === 'finalize_subscription')?.success,
          phoneNumber: phoneNumber
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('FATAL ERROR', { message: errorMessage });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        steps: results
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
