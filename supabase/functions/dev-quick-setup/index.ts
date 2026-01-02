import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, getUserFromAuth } from "../_shared/db.ts";
import { corsPreflightResponse, errorResponse, successResponse } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logger.ts";
import { config } from "../_shared/config.ts";

const logger = createLogger('dev-quick-setup');

// Sample services data
const SAMPLE_SERVICES = [
  { name: 'General Consultation', description: 'Initial consultation and examination', category: 'consultation', price_cents: 15000, duration_minutes: 30 },
  { name: 'Deep Cleaning', description: 'Professional teeth cleaning', category: 'routine', price_cents: 25000, duration_minutes: 60 },
  { name: 'Teeth Whitening', description: 'Professional whitening treatment', category: 'cosmetic', price_cents: 35000, duration_minutes: 45 },
  { name: 'Emergency Visit', description: 'Urgent dental care', category: 'emergency', price_cents: 20000, duration_minutes: 30 },
];

// Sample contacts data
const SAMPLE_CONTACTS = [
  { name: 'David Johnson', phone: '+15559991111', email: 'david.johnson@example.com', status: 'customer', source: 'inbound_call' },
  { name: 'Lisa Park', phone: '+15558882222', email: 'lisa.park@example.com', status: 'customer', source: 'inbound_call' },
  { name: 'Mark Stevens', phone: '+15557773333', email: null, status: 'lead', source: 'inbound_call' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  try {
    const log = logger.withContext({ requestId: crypto.randomUUID() });
    log.step('Starting Dev Quick Setup');

    // CRITICAL: Only allow in local development
    if (!config.isLocal) {
      log.error('Dev Quick Setup blocked - not local environment', undefined, { environment: config.environment });
      return errorResponse('Dev Quick Setup is only available in local development', 403);
    }

    // Authenticate user
    const supabaseAdmin = createServiceClient();
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await getUserFromAuth(authHeader);

    if (authError || !user) {
      return errorResponse(authError || 'Invalid token', 401);
    }

    log.info('User authenticated', { userId: user.id });

    // Get user's institution
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.institution_id) {
      return errorResponse('No institution found. Please sign up first.', 404);
    }

    const institutionId = profile.institution_id;

    // Get institution details
    const { data: institution, error: instError } = await supabaseAdmin
      .from('institutions')
      .select('*')
      .eq('id', institutionId)
      .single();

    if (instError || !institution) {
      return errorResponse('Institution not found', 404);
    }

    log.info('Setting up institution', { institutionId, name: institution.name });

    // --- STEP 1: Clean existing sample data ---
    log.step('Cleaning existing data');

    // Delete existing calls for this institution
    await supabaseAdmin
      .from('calls')
      .delete()
      .eq('institution_id', institutionId);

    // Delete existing contacts for this institution
    await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('institution_id', institutionId);

    // Delete existing services for this institution
    await supabaseAdmin
      .from('services')
      .delete()
      .eq('institution_id', institutionId);

    // Delete existing phone numbers
    await supabaseAdmin
      .from('phone_numbers')
      .delete()
      .eq('institution_id', institutionId);

    log.info('Cleaned existing data');

    // --- STEP 2: Create subscription (Business plan, active, mock Stripe) ---
    log.step('Setting up subscription');

    const subscriptionData = {
      institution_id: institutionId,
      plan: 'business',
      status: 'active',
      stripe_customer_id: 'cus_dev_mock_123',
      stripe_subscription_id: 'sub_dev_mock_456',
      total_credits: 72000,
      used_credits: 0,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'institution_id' });

    if (subError) {
      log.error('Subscription setup failed', subError);
      throw new Error(`Subscription setup failed: ${subError.message}`);
    }

    log.info('Subscription created', { plan: 'business', status: 'active' });

    // --- STEP 3: Purchase real phone number ---
    log.step('Purchasing phone number');

    // Extract area code from business phone or use default
    const businessPhone = institution.business_phone_number || '+15551234567';
    const areaCode = businessPhone.replace(/\D/g, '').slice(-10, -7) || '555';

    const phoneResponse = await fetch(`${config.supabase.url}/functions/v1/purchase-phone-number`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessPhoneNumber: businessPhone,
        areaCode: areaCode,
      }),
    });

    const phoneResult = await phoneResponse.json();

    if (!phoneResponse.ok) {
      log.warn('Phone purchase failed, continuing anyway', { error: phoneResult.error });
    } else {
      log.info('Phone number purchased', { phoneNumber: phoneResult.phoneNumber });
    }

    // --- STEP 4: Insert sample services ---
    log.step('Creating sample services');

    const servicesWithInstitution = SAMPLE_SERVICES.map(s => ({
      ...s,
      institution_id: institutionId,
      is_active: true,
    }));

    const { error: servicesError } = await supabaseAdmin
      .from('services')
      .insert(servicesWithInstitution);

    if (servicesError) {
      log.warn('Services insert failed', { error: servicesError.message });
    } else {
      log.info('Sample services created', { count: SAMPLE_SERVICES.length });
    }

    // --- STEP 5: Create real ElevenLabs agent ---
    log.step('Creating ElevenLabs agent');

    // Build context with sample services
    const agentContext = JSON.stringify({
      greeting: `Hi! Thanks for calling ${institution.name}. How can I help you today?`,
      services: SAMPLE_SERVICES.map(s => ({
        name: s.name,
        price: s.price_cents / 100,
        duration: s.duration_minutes,
      })),
      customInstructions: '',
      businessType: 'Dental Practice',
    });

    const agentResponse = await fetch(`${config.supabase.url}/functions/v1/elevenlabs-agent`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create-agent',
        institutionId: institutionId,
        context: agentContext,
      }),
    });

    const agentResult = await agentResponse.json();

    if (!agentResponse.ok) {
      log.warn('Agent creation failed, continuing anyway', { error: agentResult.error });
    } else {
      log.info('ElevenLabs agent created', { agentId: agentResult.agent_id });
    }

    // --- STEP 6: Insert sample contacts ---
    log.step('Creating sample contacts');

    const contactsWithInstitution = SAMPLE_CONTACTS.map(c => ({
      ...c,
      institution_id: institutionId,
      lead_status: c.status === 'lead' ? 'new' : 'converted',
    }));

    const { error: contactsError } = await supabaseAdmin
      .from('contacts')
      .insert(contactsWithInstitution);

    if (contactsError) {
      log.warn('Contacts insert failed', { error: contactsError.message });
    } else {
      log.info('Sample contacts created', { count: SAMPLE_CONTACTS.length });
    }

    // --- STEP 7: Insert sample calls ---
    log.step('Creating sample calls');

    // Get the phone number we just created
    const { data: phoneNumbers } = await supabaseAdmin
      .from('phone_numbers')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .limit(1);

    const phoneNumberId = phoneNumbers?.[0]?.id;

    if (phoneNumberId) {
      const now = Date.now();
      const sampleCalls = [
        {
          institution_id: institutionId,
          phone_number_id: phoneNumberId,
          twilio_call_sid: `CA_dev_${crypto.randomUUID().substring(0, 8)}`,
          caller_phone: '+15559991111',
          caller_name: 'David Johnson',
          status: 'completed',
          outcome: 'booked',
          duration_seconds: 245,
          summary: 'Tooth pain issue. Appointment scheduled for tomorrow morning.',
          started_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(now - 2 * 60 * 60 * 1000 + 245000).toISOString(),
        },
        {
          institution_id: institutionId,
          phone_number_id: phoneNumberId,
          twilio_call_sid: `CA_dev_${crypto.randomUUID().substring(0, 8)}`,
          caller_phone: '+15558882222',
          caller_name: 'Lisa Park',
          status: 'completed',
          outcome: 'booked',
          duration_seconds: 180,
          summary: 'Routine checkup request. Appointment scheduled for next week.',
          started_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(now - 5 * 60 * 60 * 1000 + 180000).toISOString(),
        },
        {
          institution_id: institutionId,
          phone_number_id: phoneNumberId,
          twilio_call_sid: `CA_dev_${crypto.randomUUID().substring(0, 8)}`,
          caller_phone: '+15557773333',
          caller_name: null,
          status: 'completed',
          outcome: 'callback_requested',
          duration_seconds: 95,
          summary: 'Patient inquiring about pricing. Left message for callback.',
          started_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(now - 24 * 60 * 60 * 1000 + 95000).toISOString(),
        },
      ];

      const { error: callsError } = await supabaseAdmin
        .from('calls')
        .insert(sampleCalls);

      if (callsError) {
        log.warn('Calls insert failed', { error: callsError.message });
      } else {
        log.info('Sample calls created', { count: sampleCalls.length });
      }
    }

    // --- STEP 8: Mark onboarding complete ---
    log.step('Marking onboarding complete');

    const { error: orgError } = await supabaseAdmin
      .from('institutions')
      .update({
        is_onboarding_complete: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', institutionId);

    if (orgError) {
      log.warn('Onboarding update failed', { error: orgError.message });
    }

    log.info('Dev Quick Setup complete!');

    return successResponse({
      success: true,
      message: 'Dev Quick Setup complete!',
      data: {
        institutionId,
        institutionName: institution.name,
        subscription: { plan: 'business', status: 'active', credits: 72000 },
        phoneNumber: phoneResult.phoneNumber || 'Not purchased',
        agentId: agentResult.agent_id || 'Not created',
        samplesCreated: {
          services: SAMPLE_SERVICES.length,
          contacts: SAMPLE_CONTACTS.length,
          calls: phoneNumberId ? 3 : 0,
        },
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Dev Quick Setup failed', error as Error);
    return errorResponse(errorMessage, 500);
  }
});
