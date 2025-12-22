import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function should be called by a cron job every minute
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scheduled reminders at:', new Date().toISOString());

    // Find pending reminders that are due (scheduled_time <= now)
    const { data: dueReminders, error } = await supabase
      .from('appointment_reminders')
      .select(`
        id,
        appointment_id,
        organization_id,
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
      .in('appointments.status', ['scheduled', 'confirmed']) // Only for active appointments
      .limit(10); // Process max 10 at a time to avoid timeouts

    if (error) {
      console.error('Error fetching due reminders:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch reminders' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log('No reminders due at this time');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${dueReminders.length} reminders to process`);

    // Check subscription tier for each organization
    const orgIds = [...new Set(dueReminders.map(r => r.organization_id))];
    
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('organization_id, plan')
      .in('organization_id', orgIds)
      .eq('status', 'active');

    const { data: tiers } = await supabase
      .from('subscription_tiers')
      .select('plan_id, has_outbound_reminders')
      .eq('has_outbound_reminders', true);

    const allowedPlans = new Set((tiers || []).map(t => t.plan_id));
    const orgPlans: Record<string, string> = {};
    (subscriptions || []).forEach(s => {
      orgPlans[s.organization_id] = s.plan;
    });

    const results: { reminderId: string; success: boolean; error?: string }[] = [];

    // Process each reminder
    for (const reminder of dueReminders) {
      const orgPlan = orgPlans[reminder.organization_id];
      
      // Check if organization has outbound reminders feature
      if (!allowedPlans.has(orgPlan)) {
        console.log(`Skipping reminder ${reminder.id} - org plan ${orgPlan} doesn't have outbound reminders`);
        
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
          console.log(`Successfully initiated reminder call for ${reminder.id}`);
          results.push({ reminderId: reminder.id, success: true });
        } else {
          const errorText = await response.text();
          console.error(`Failed to initiate reminder ${reminder.id}:`, errorText);
          results.push({ reminderId: reminder.id, success: false, error: errorText });
        }
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
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
    console.log(`Processed ${dueReminders.length} reminders, ${successful} successful`);

    return new Response(JSON.stringify({ 
      processed: dueReminders.length,
      successful,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-scheduled-reminders:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
