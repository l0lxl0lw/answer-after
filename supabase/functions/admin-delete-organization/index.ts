import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-DELETE-ORG] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { organizationId } = await req.json();

    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    logStep('Starting deletion process', { organizationId });

    // Get organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      throw new Error('Organization not found');
    }

    logStep('Found organization', { name: org.name });

    // Get the ElevenLabs agent ID separately
    const { data: agentRecord, error: agentRecordError } = await supabaseAdmin
      .from('organization_agents')
      .select('elevenlabs_agent_id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (agentRecordError) {
      logStep('Error fetching agent record', { error: agentRecordError });
    }

    // Step 1: Delete ElevenLabs agent if exists
    const agentId = agentRecord?.elevenlabs_agent_id;
    logStep('ElevenLabs agent check', {
      agentId,
      hasApiKey: !!ELEVENLABS_API_KEY,
      agentRecord
    });

    if (agentId) {
      if (!ELEVENLABS_API_KEY) {
        logStep('WARNING: ELEVENLABS_API_KEY not set, cannot delete agent');
      } else {
        logStep('Deleting ElevenLabs agent', { agentId });

        try {
          const deleteResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
            {
              method: 'DELETE',
              headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
              },
            }
          );

          const responseText = await deleteResponse.text();

          if (deleteResponse.ok) {
            logStep('ElevenLabs agent deleted successfully');
          } else {
            logStep('Failed to delete ElevenLabs agent', {
              status: deleteResponse.status,
              statusText: deleteResponse.statusText,
              response: responseText,
            });
          }
        } catch (error) {
          logStep('Error deleting ElevenLabs agent', { error: String(error) });
        }
      }
    } else {
      logStep('No ElevenLabs agent found for this organization');
    }

    // Step 2: Delete phone numbers from ElevenLabs and reset Twilio webhooks
    logStep('Getting phone numbers for organization');
    const { data: phoneNumbers } = await supabaseAdmin
      .from('phone_numbers')
      .select('phone_number, twilio_sid, elevenlabs_phone_number_id')
      .eq('organization_id', organizationId);

    if (phoneNumbers && phoneNumbers.length > 0) {
      logStep('Processing phone numbers', {
        count: phoneNumbers.length,
        numbers: phoneNumbers.map(p => p.phone_number),
      });

      // Delete phone numbers from ElevenLabs first
      if (ELEVENLABS_API_KEY) {
        for (const phone of phoneNumbers) {
          if (phone.elevenlabs_phone_number_id) {
            try {
              logStep('Deleting phone number from ElevenLabs', {
                phoneNumber: phone.phone_number,
                elevenlabsId: phone.elevenlabs_phone_number_id,
              });

              const deleteResponse = await fetch(
                `https://api.elevenlabs.io/v1/convai/phone-numbers/${phone.elevenlabs_phone_number_id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                  },
                }
              );

              if (deleteResponse.ok) {
                logStep('Phone number deleted from ElevenLabs successfully', { phoneNumber: phone.phone_number });
              } else {
                const errorText = await deleteResponse.text();
                logStep('Failed to delete phone number from ElevenLabs', {
                  phoneNumber: phone.phone_number,
                  status: deleteResponse.status,
                  error: errorText,
                });
              }
            } catch (error) {
              logStep('Error deleting phone number from ElevenLabs', {
                phoneNumber: phone.phone_number,
                error: String(error),
              });
            }
          }
        }
      }

      // Reset Twilio webhooks
      logStep('Resetting Twilio webhooks for phone numbers');

      // Reset Twilio webhooks to default demo URLs
      const twilioSubaccountSid = org.twilio_subaccount_sid;
      const twilioSubaccountAuthToken = org.twilio_subaccount_auth_token;

      if (twilioSubaccountSid && twilioSubaccountAuthToken) {
        for (const phone of phoneNumbers) {
          if (phone.twilio_sid) {
            try {
              logStep('Resetting webhook for phone', { phoneNumber: phone.phone_number, sid: phone.twilio_sid });

              const updateResponse = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioSubaccountSid}/IncomingPhoneNumbers/${phone.twilio_sid}.json`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${btoa(`${twilioSubaccountSid}:${twilioSubaccountAuthToken}`)}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    VoiceUrl: 'https://demo.twilio.com/welcome/voice/',
                    VoiceMethod: 'POST',
                    SmsUrl: 'https://demo.twilio.com/welcome/sms/reply',
                    SmsMethod: 'POST',
                  }),
                }
              );

              if (updateResponse.ok) {
                logStep('Twilio webhook reset successfully', { phoneNumber: phone.phone_number });
              } else {
                const errorText = await updateResponse.text();
                logStep('Failed to reset Twilio webhook', {
                  phoneNumber: phone.phone_number,
                  status: updateResponse.status,
                  error: errorText,
                });
              }
            } catch (error) {
              logStep('Error resetting Twilio webhook', {
                phoneNumber: phone.phone_number,
                error: String(error),
              });
            }
          }
        }
      } else if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        // Fallback to main account if subaccount credentials not available
        logStep('Using main Twilio account to reset webhooks (no subaccount credentials)');
        for (const phone of phoneNumbers) {
          if (phone.twilio_sid) {
            try {
              const updateResponse = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phone.twilio_sid}.json`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    VoiceUrl: 'https://demo.twilio.com/welcome/voice/',
                    VoiceMethod: 'POST',
                    SmsUrl: 'https://demo.twilio.com/welcome/sms/reply',
                    SmsMethod: 'POST',
                  }),
                }
              );

              if (updateResponse.ok) {
                logStep('Twilio webhook reset successfully (main account)', { phoneNumber: phone.phone_number });
              } else {
                const errorText = await updateResponse.text();
                logStep('Failed to reset Twilio webhook (main account)', {
                  phoneNumber: phone.phone_number,
                  status: updateResponse.status,
                  error: errorText,
                });
              }
            } catch (error) {
              logStep('Error resetting Twilio webhook (main account)', {
                phoneNumber: phone.phone_number,
                error: String(error),
              });
            }
          }
        }
      } else {
        logStep('WARNING: No Twilio credentials available to reset webhooks');
      }
    }

    // Step 3: Delete database records in proper order (due to foreign keys)
    // Note: Many tables have ON DELETE CASCADE, but we'll be explicit for clarity

    // Delete appointment reminders
    logStep('Deleting appointment reminders');
    const { error: remindersError } = await supabaseAdmin
      .from('appointment_reminders')
      .delete()
      .eq('organization_id', organizationId);

    if (remindersError) {
      logStep('Error deleting appointment reminders', { error: remindersError });
      throw new Error(`Failed to delete appointment reminders: ${remindersError.message}`);
    }

    // Delete appointments
    logStep('Deleting appointments');
    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('organization_id', organizationId);

    if (appointmentsError) {
      logStep('Error deleting appointments', { error: appointmentsError });
      throw new Error(`Failed to delete appointments: ${appointmentsError.message}`);
    }

    // Delete call transcripts (via call_id foreign key)
    logStep('Deleting call transcripts');
    const { data: calls } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('organization_id', organizationId);

    if (calls && calls.length > 0) {
      const callIds = calls.map(c => c.id);

      const { error: transcriptsError } = await supabaseAdmin
        .from('call_transcripts')
        .delete()
        .in('call_id', callIds);

      if (transcriptsError) {
        logStep('Error deleting call transcripts', { error: transcriptsError });
      }

      const { error: eventsError } = await supabaseAdmin
        .from('call_events')
        .delete()
        .in('call_id', callIds);

      if (eventsError) {
        logStep('Error deleting call events', { error: eventsError });
      }
    }

    // Delete calls
    logStep('Deleting calls');
    const { error: callsError } = await supabaseAdmin
      .from('calls')
      .delete()
      .eq('organization_id', organizationId);

    if (callsError) {
      logStep('Error deleting calls', { error: callsError });
      throw new Error(`Failed to delete calls: ${callsError.message}`);
    }

    // Delete services
    logStep('Deleting services');

    // First check if there are any services
    const { data: existingServices, error: servicesCheckError } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('organization_id', organizationId);

    if (servicesCheckError) {
      logStep('Error checking services', { error: servicesCheckError });
    } else {
      logStep('Found services to delete', { count: existingServices?.length || 0 });
    }

    const { error: servicesError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('organization_id', organizationId);

    if (servicesError) {
      logStep('Error deleting services', { error: servicesError });
      throw new Error(`Failed to delete services: ${servicesError.message}`);
    }

    logStep('Services deleted successfully');

    // Delete phone_numbers records (must be after calls are deleted due to FK)
    // Twilio numbers remain in Twilio for manual reuse
    logStep('Deleting phone_numbers records');
    const { error: phoneError } = await supabaseAdmin
      .from('phone_numbers')
      .delete()
      .eq('organization_id', organizationId);

    if (phoneError) {
      logStep('Error deleting phone numbers', { error: phoneError });
      throw new Error(`Failed to delete phone numbers: ${phoneError.message}`);
    }

    logStep('Phone numbers deleted successfully');

    // Delete purchased credits
    logStep('Deleting purchased credits');
    const { error: creditsError } = await supabaseAdmin
      .from('purchased_credits')
      .delete()
      .eq('organization_id', organizationId);

    if (creditsError) {
      logStep('Error deleting purchased credits', { error: creditsError });
      throw new Error(`Failed to delete purchased credits: ${creditsError.message}`);
    }

    // Delete subscriptions
    logStep('Deleting subscriptions');
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('organization_id', organizationId);

    if (subscriptionsError) {
      logStep('Error deleting subscriptions', { error: subscriptionsError });
      throw new Error(`Failed to delete subscriptions: ${subscriptionsError.message}`);
    }

    // Delete Google calendar connections
    logStep('Deleting Google calendar connections');
    const { error: calendarError } = await supabaseAdmin
      .from('google_calendar_connections')
      .delete()
      .eq('organization_id', organizationId);

    if (calendarError) {
      logStep('Error deleting Google calendar connections', { error: calendarError });
      throw new Error(`Failed to delete Google calendar connections: ${calendarError.message}`);
    }

    // Delete organization agents
    logStep('Deleting organization agents');
    const { error: agentsError } = await supabaseAdmin
      .from('organization_agents')
      .delete()
      .eq('organization_id', organizationId);

    if (agentsError) {
      logStep('Error deleting organization agents', { error: agentsError });
      throw new Error(`Failed to delete organization agents: ${agentsError.message}`);
    }

    // Delete user roles and profiles
    logStep('Deleting user profiles and roles');
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('organization_id', organizationId);

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map(p => p.id);

      // Delete user roles
      const { error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .in('user_id', userIds);

      if (rolesError) {
        logStep('Error deleting user roles', { error: rolesError });
        throw new Error(`Failed to delete user roles: ${rolesError.message}`);
      }

      // Delete profiles
      const { error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .in('id', userIds);

      if (profilesError) {
        logStep('Error deleting profiles', { error: profilesError });
        throw new Error(`Failed to delete profiles: ${profilesError.message}`);
      }

      // Delete auth users
      for (const userId of userIds) {
        try {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (deleteUserError) {
            logStep('Error deleting auth user (non-fatal)', { userId, error: deleteUserError });
          }
        } catch (error) {
          logStep('Error deleting auth user (non-fatal)', { userId, error: String(error) });
        }
      }
    }

    // Step 4: Finally, delete the organization
    logStep('Deleting organization');
    const { error: deleteOrgError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organizationId);

    if (deleteOrgError) {
      throw new Error(`Failed to delete organization: ${deleteOrgError.message}`);
    }

    logStep('Organization deleted successfully', { organizationId });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Organization and all resources deleted successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
