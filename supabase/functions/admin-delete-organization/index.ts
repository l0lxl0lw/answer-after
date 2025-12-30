import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { validateUUID, parseJsonBody } from "../_shared/validation.ts";
import { deleteAgent, deletePhoneNumber, getElevenLabsApiKey } from "../_shared/elevenlabs.ts";
import { getTwilioCredentials, makeTwilioRequest, getAccountUrl, getTwilioAuthHeader } from "../_shared/twilio.ts";

const logger = createLogger('admin-delete-organization');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const supabaseAdmin = createServiceClient();

    const { organizationId } = await parseJsonBody<{ organizationId: string }>(req, ['organizationId']);
    validateUUID(organizationId, 'organizationId');

    log.step('Starting deletion process', { organizationId });

    // Get organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return errorResponse('Organization not found', 404);
    }

    log.info('Found organization', { name: org.name });

    // Get the ElevenLabs agent ID
    const { data: agentRecord, error: agentRecordError } = await supabaseAdmin
      .from('organization_agents')
      .select('elevenlabs_agent_id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (agentRecordError) {
      log.warn('Error fetching agent record', { error: agentRecordError.message });
    }

    // Step 1: Delete ElevenLabs agent if exists
    const agentId = agentRecord?.elevenlabs_agent_id;
    let elevenLabsApiKey: string | null = null;

    try {
      elevenLabsApiKey = getElevenLabsApiKey();
    } catch {
      log.warn('ELEVENLABS_API_KEY not set');
    }

    log.info('ElevenLabs agent check', { agentId, hasApiKey: !!elevenLabsApiKey });

    if (agentId && elevenLabsApiKey) {
      log.step('Deleting ElevenLabs agent', { agentId });
      try {
        await deleteAgent(agentId, elevenLabsApiKey);
        log.info('ElevenLabs agent deleted successfully');
      } catch (error) {
        log.warn('Failed to delete ElevenLabs agent', { error: (error as Error).message });
      }
    } else if (agentId) {
      log.warn('Cannot delete agent - no API key');
    } else {
      log.info('No ElevenLabs agent found for this organization');
    }

    // Step 2: Delete phone numbers from ElevenLabs and reset Twilio webhooks
    log.step('Getting phone numbers for organization');
    const { data: phoneNumbers } = await supabaseAdmin
      .from('phone_numbers')
      .select('phone_number, twilio_sid, elevenlabs_phone_number_id')
      .eq('organization_id', organizationId);

    if (phoneNumbers && phoneNumbers.length > 0) {
      log.info('Processing phone numbers', {
        count: phoneNumbers.length,
        numbers: phoneNumbers.map(p => p.phone_number),
      });

      // Delete phone numbers from ElevenLabs
      if (elevenLabsApiKey) {
        for (const phone of phoneNumbers) {
          if (phone.elevenlabs_phone_number_id) {
            try {
              log.step('Deleting phone from ElevenLabs', { phoneNumber: phone.phone_number });
              await deletePhoneNumber(phone.elevenlabs_phone_number_id, elevenLabsApiKey);
              log.info('Phone deleted from ElevenLabs', { phoneNumber: phone.phone_number });
            } catch (error) {
              log.warn('Failed to delete phone from ElevenLabs', {
                phoneNumber: phone.phone_number,
                error: (error as Error).message,
              });
            }
          }
        }
      }

      // Reset Twilio webhooks
      log.step('Resetting Twilio webhooks');

      const twilioSubaccountSid = org.twilio_subaccount_sid;
      const twilioSubaccountAuthToken = org.twilio_subaccount_auth_token;

      let twilioAccountSid: string | null = null;
      let twilioAuthToken: string | null = null;

      try {
        const creds = getTwilioCredentials();
        twilioAccountSid = creds.accountSid;
        twilioAuthToken = creds.authToken;
      } catch {
        log.warn('Twilio credentials not configured');
      }

      const resetWebhookBody = {
        VoiceUrl: 'https://demo.twilio.com/welcome/voice/',
        VoiceMethod: 'POST',
        SmsUrl: 'https://demo.twilio.com/welcome/sms/reply',
        SmsMethod: 'POST',
      };

      if (twilioSubaccountSid && twilioSubaccountAuthToken) {
        for (const phone of phoneNumbers) {
          if (phone.twilio_sid) {
            try {
              log.step('Resetting webhook', { phoneNumber: phone.phone_number });
              await makeTwilioRequest(
                `${getAccountUrl(twilioSubaccountSid)}/IncomingPhoneNumbers/${phone.twilio_sid}.json`,
                {
                  accountSid: twilioSubaccountSid,
                  authToken: twilioSubaccountAuthToken,
                  method: 'POST',
                  body: resetWebhookBody,
                }
              );
              log.info('Webhook reset successfully', { phoneNumber: phone.phone_number });
            } catch (error) {
              log.warn('Failed to reset webhook', {
                phoneNumber: phone.phone_number,
                error: (error as Error).message,
              });
            }
          }
        }
      } else if (twilioAccountSid && twilioAuthToken) {
        log.info('Using main Twilio account to reset webhooks');
        for (const phone of phoneNumbers) {
          if (phone.twilio_sid) {
            try {
              await makeTwilioRequest(
                `${getAccountUrl(twilioAccountSid)}/IncomingPhoneNumbers/${phone.twilio_sid}.json`,
                {
                  accountSid: twilioAccountSid,
                  authToken: twilioAuthToken,
                  method: 'POST',
                  body: resetWebhookBody,
                }
              );
              log.info('Webhook reset (main account)', { phoneNumber: phone.phone_number });
            } catch (error) {
              log.warn('Failed to reset webhook (main account)', {
                phoneNumber: phone.phone_number,
                error: (error as Error).message,
              });
            }
          }
        }
      } else {
        log.warn('No Twilio credentials available to reset webhooks');
      }
    }

    // Step 3: Delete database records in proper order

    // Delete appointment reminders
    log.step('Deleting appointment reminders');
    const { error: remindersError } = await supabaseAdmin
      .from('appointment_reminders')
      .delete()
      .eq('organization_id', organizationId);

    if (remindersError) {
      throw new Error(`Failed to delete appointment reminders: ${remindersError.message}`);
    }

    // Delete appointments
    log.step('Deleting appointments');
    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('organization_id', organizationId);

    if (appointmentsError) {
      throw new Error(`Failed to delete appointments: ${appointmentsError.message}`);
    }

    // Delete call transcripts and events
    log.step('Deleting call data');
    const { data: calls } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('organization_id', organizationId);

    if (calls && calls.length > 0) {
      const callIds = calls.map(c => c.id);

      await supabaseAdmin.from('call_transcripts').delete().in('call_id', callIds);
      await supabaseAdmin.from('call_events').delete().in('call_id', callIds);
    }

    // Delete calls
    log.step('Deleting calls');
    const { error: callsError } = await supabaseAdmin
      .from('calls')
      .delete()
      .eq('organization_id', organizationId);

    if (callsError) {
      throw new Error(`Failed to delete calls: ${callsError.message}`);
    }

    // Delete services
    log.step('Deleting services');
    const { error: servicesError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('organization_id', organizationId);

    if (servicesError) {
      throw new Error(`Failed to delete services: ${servicesError.message}`);
    }

    // Delete phone_numbers records
    log.step('Deleting phone number records');
    const { error: phoneError } = await supabaseAdmin
      .from('phone_numbers')
      .delete()
      .eq('organization_id', organizationId);

    if (phoneError) {
      throw new Error(`Failed to delete phone numbers: ${phoneError.message}`);
    }

    // Delete purchased credits
    log.step('Deleting purchased credits');
    const { error: creditsError } = await supabaseAdmin
      .from('purchased_credits')
      .delete()
      .eq('organization_id', organizationId);

    if (creditsError) {
      throw new Error(`Failed to delete purchased credits: ${creditsError.message}`);
    }

    // Delete subscriptions
    log.step('Deleting subscriptions');
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('organization_id', organizationId);

    if (subscriptionsError) {
      throw new Error(`Failed to delete subscriptions: ${subscriptionsError.message}`);
    }

    // Delete Google calendar connections
    log.step('Deleting Google calendar connections');
    const { error: calendarError } = await supabaseAdmin
      .from('google_calendar_connections')
      .delete()
      .eq('organization_id', organizationId);

    if (calendarError) {
      throw new Error(`Failed to delete Google calendar connections: ${calendarError.message}`);
    }

    // Delete organization agents
    log.step('Deleting organization agents');
    const { error: agentsError } = await supabaseAdmin
      .from('organization_agents')
      .delete()
      .eq('organization_id', organizationId);

    if (agentsError) {
      throw new Error(`Failed to delete organization agents: ${agentsError.message}`);
    }

    // Delete user roles and profiles
    log.step('Deleting user profiles and roles');
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
        throw new Error(`Failed to delete user roles: ${rolesError.message}`);
      }

      // Delete profiles
      const { error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .in('id', userIds);

      if (profilesError) {
        throw new Error(`Failed to delete profiles: ${profilesError.message}`);
      }

      // Delete auth users
      for (const userId of userIds) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (error) {
          log.warn('Error deleting auth user (non-fatal)', { userId, error: (error as Error).message });
        }
      }
    }

    // Step 4: Finally, delete the organization
    log.step('Deleting organization');
    const { error: deleteOrgError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organizationId);

    if (deleteOrgError) {
      throw new Error(`Failed to delete organization: ${deleteOrgError.message}`);
    }

    log.info('Organization deleted successfully', { organizationId });

    return successResponse({
      success: true,
      message: 'Organization and all resources deleted successfully',
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
