import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { validateUUID, parseJsonBody } from "../_shared/validation.ts";
import { deleteAgent, deletePhoneNumber, getElevenLabsApiKey } from "../_shared/elevenlabs.ts";
import { getTwilioCredentials, makeTwilioRequest, getAccountUrl, getTwilioAuthHeader } from "../_shared/twilio.ts";

const logger = createLogger('admin-delete-account');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });

    const supabaseAdmin = createServiceClient();

    // Support both accountId and institutionId for backward compatibility
    const body = await parseJsonBody<{ accountId?: string; institutionId?: string }>(req);
    const accountId = body.accountId || body.institutionId;

    if (!accountId) {
      return errorResponse('accountId is required', 400);
    }
    validateUUID(accountId, 'accountId');

    log.step('Starting deletion process', { accountId });

    // Get account details
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return errorResponse('Account not found', 404);
    }

    log.info('Found account', { name: account.name });

    // Get the ElevenLabs agent ID
    const { data: agentRecord, error: agentRecordError } = await supabaseAdmin
      .from('account_agents')
      .select('elevenlabs_agent_id')
      .eq('account_id', accountId)
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
      log.info('No ElevenLabs agent found for this account');
    }

    // Step 2: Delete phone numbers from ElevenLabs and reset Twilio webhooks
    log.step('Getting phone numbers for account');
    const { data: phoneNumbers } = await supabaseAdmin
      .from('phone_numbers')
      .select('phone_number, twilio_sid, elevenlabs_phone_number_id')
      .eq('account_id', accountId);

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

      const twilioSubaccountSid = account.twilio_subaccount_sid;
      const twilioSubaccountAuthToken = account.twilio_subaccount_auth_token;

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
      .eq('account_id', accountId);

    if (remindersError) {
      throw new Error(`Failed to delete appointment reminders: ${remindersError.message}`);
    }

    // Delete appointments
    log.step('Deleting appointments');
    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('account_id', accountId);

    if (appointmentsError) {
      throw new Error(`Failed to delete appointments: ${appointmentsError.message}`);
    }

    // Delete call transcripts and events
    log.step('Deleting call data');
    const { data: calls } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('account_id', accountId);

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
      .eq('account_id', accountId);

    if (callsError) {
      throw new Error(`Failed to delete calls: ${callsError.message}`);
    }

    // Delete services
    log.step('Deleting services');
    const { error: servicesError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('account_id', accountId);

    if (servicesError) {
      throw new Error(`Failed to delete services: ${servicesError.message}`);
    }

    // Delete phone_numbers records
    log.step('Deleting phone number records');
    const { error: phoneError } = await supabaseAdmin
      .from('phone_numbers')
      .delete()
      .eq('account_id', accountId);

    if (phoneError) {
      throw new Error(`Failed to delete phone numbers: ${phoneError.message}`);
    }

    // Delete purchased credits
    log.step('Deleting purchased credits');
    const { error: creditsError } = await supabaseAdmin
      .from('purchased_credits')
      .delete()
      .eq('account_id', accountId);

    if (creditsError) {
      throw new Error(`Failed to delete purchased credits: ${creditsError.message}`);
    }

    // Delete subscriptions
    log.step('Deleting subscriptions');
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('account_id', accountId);

    if (subscriptionsError) {
      throw new Error(`Failed to delete subscriptions: ${subscriptionsError.message}`);
    }

    // Delete account agents
    log.step('Deleting account agents');
    const { error: agentsError } = await supabaseAdmin
      .from('account_agents')
      .delete()
      .eq('account_id', accountId);

    if (agentsError) {
      throw new Error(`Failed to delete account agents: ${agentsError.message}`);
    }

    // Delete user roles and profiles
    log.step('Deleting user profiles and roles');
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('account_id', accountId);

    if (users && users.length > 0) {
      const userIds = users.map(u => u.id);

      // Delete user roles
      const { error: rolesError } = await supabaseAdmin
        .from('roles')
        .delete()
        .in('user_id', userIds);

      if (rolesError) {
        throw new Error(`Failed to delete user roles: ${rolesError.message}`);
      }

      // Delete users
      const { error: usersError } = await supabaseAdmin
        .from('users')
        .delete()
        .in('id', userIds);

      if (usersError) {
        throw new Error(`Failed to delete users: ${usersError.message}`);
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

    // Step 4: Finally, delete the account
    log.step('Deleting account');
    const { error: deleteAccountError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (deleteAccountError) {
      throw new Error(`Failed to delete account: ${deleteAccountError.message}`);
    }

    log.info('Account deleted successfully', { accountId });

    return successResponse({
      success: true,
      message: 'Account and all resources deleted successfully',
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse(error as Error);
  }
});
