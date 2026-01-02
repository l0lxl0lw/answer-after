import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";

const logger = createLogger('process-scheduled-reminders');

// This function should be called by a cron job every minute
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    const supabase = createServiceClient();

    log.info('Processing scheduled reminders', { timestamp: new Date().toISOString() });

    // Find pending reminders that are due (scheduled_time <= now)
    const { data: dueReminders, error } = await supabase
      .from('appointment_reminders')
      .select(`
        id,
        appointment_id,
        institution_id,
        scheduled_time,
        appointments!inner(
          id,
          status,
          customer_phone,
          customer_name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_time', new Date().toISOString())
      .in('appointments.status', ['scheduled', 'confirmed'])
      .limit(10);

    if (error) {
      log.error('Error fetching due reminders', error);
      return errorResponse('Failed to fetch reminders', 500);
    }

    if (!dueReminders || dueReminders.length === 0) {
      log.info('No reminders due at this time');
      return successResponse({ processed: 0 });
    }

    log.info('Found reminders to process', { count: dueReminders.length });

    // Check subscription tier for each organization
    const orgIds = [...new Set(dueReminders.map(r => r.institution_id))];

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('institution_id, plan')
      .in('institution_id', orgIds)
      .eq('status', 'active');

    const { data: tiers } = await supabase
      .from('subscription_tiers')
      .select('plan_id, has_outbound_reminders')
      .eq('has_outbound_reminders', true);

    const allowedPlans = new Set((tiers || []).map(t => t.plan_id));
    const orgPlans: Record<string, string> = {};
    (subscriptions || []).forEach(s => {
      orgPlans[s.institution_id] = s.plan;
    });

    const results: { reminderId: string; success: boolean; error?: string }[] = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Process each reminder
    for (const reminder of dueReminders) {
      const orgPlan = orgPlans[reminder.institution_id];

      // Check if organization has outbound reminders feature
      if (!allowedPlans.has(orgPlan)) {
        log.info('Skipping reminder - plan not eligible', { reminderId: reminder.id, plan: orgPlan });

        await supabase
          .from('appointment_reminders')
          .update({
            status: 'cancelled',
            notes: 'Subscription plan does not include outbound reminders'
          })
          .eq('id', reminder.id);

        results.push({
          reminderId: reminder.id,
          success: false,
          error: 'Plan not eligible'
        });
        continue;
      }

      try {
        // Call the outbound reminder function
        const response = await fetch(`${supabaseUrl}/functions/v1/outbound-reminder-call`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reminderId: reminder.id }),
        });

        if (response.ok) {
          log.info('Successfully initiated reminder call', { reminderId: reminder.id });
          results.push({ reminderId: reminder.id, success: true });
        } else {
          const errorText = await response.text();
          log.error('Failed to initiate reminder', new Error(errorText));
          results.push({ reminderId: reminder.id, success: false, error: errorText });
        }
      } catch (error) {
        log.error('Error processing reminder', error as Error);
        results.push({
          reminderId: reminder.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successful = results.filter(r => r.success).length;
    log.info('Processing complete', { processed: dueReminders.length, successful });

    return successResponse({
      processed: dueReminders.length,
      successful,
      results
    });

  } catch (error) {
    logger.error('Handler error', error as Error);
    return errorResponse('Internal server error', 500);
  }
});
