// Mock data for demo mode
import { DEMO_ACCOUNT_ID, DEMO_USER_ID } from './config';
import type {
  Account,
  Contact,
  Call,
  Appointment,
  CallIntake,
  Subscription,
  PhoneNumber
} from '@/types/database';

// Helper to generate dates relative to now
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const hoursAgo = (hours: number) => {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
};

// Demo Account
export const mockAccount: Account = {
  id: DEMO_ACCOUNT_ID,
  name: 'Acme HVAC Services',
  slug: 'acme-hvac',
  timezone: 'America/New_York',
  business_hours_start: '08:00',
  business_hours_end: '18:00',
  notification_email: 'demo@example.com',
  notification_phone: '+15551234567',
  workflow_config: {
    emergency_keywords: ['no heat', 'gas leak', 'flooding', 'smoke'],
    service_categories: ['hvac', 'plumbing', 'electrical'],
    transfer_enabled: true,
    callback_hours_offset: 2,
  },
  created_at: daysAgo(90),
  updated_at: daysAgo(1),
};

// Demo User
export const mockUser = {
  id: DEMO_USER_ID,
  email: 'demo@answerafter.com',
  full_name: 'Demo User',
  role: 'owner' as const,
  account_id: DEMO_ACCOUNT_ID,
  account: mockAccount,
};

// Demo Phone Numbers
export const mockPhoneNumbers: PhoneNumber[] = [
  {
    id: 'phone-001',
    account_id: DEMO_ACCOUNT_ID,
    twilio_sid: 'PN123456789',
    phone_number: '+15551234567',
    friendly_name: 'Main Line',
    is_active: true,
    is_after_hours_only: false,
    created_at: daysAgo(60),
    updated_at: daysAgo(1),
  },
  {
    id: 'phone-002',
    account_id: DEMO_ACCOUNT_ID,
    twilio_sid: 'PN987654321',
    phone_number: '+15559876543',
    friendly_name: 'After Hours',
    is_active: true,
    is_after_hours_only: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(1),
  },
];

// Demo Contacts
export const mockContacts: Contact[] = [
  {
    id: 'contact-001',
    account_id: DEMO_ACCOUNT_ID,
    phone: '+15552223333',
    name: 'John Smith',
    email: 'john.smith@email.com',
    address: '123 Oak Street, Boston, MA 02101',
    notes: 'Preferred morning appointments',
    status: 'customer',
    source: 'inbound_call',
    interest_level: 'hot',
    lead_status: 'converted',
    lead_notes: null,
    lead_updated_at: null,
    created_at: daysAgo(45),
    updated_at: daysAgo(2),
  },
  {
    id: 'contact-002',
    account_id: DEMO_ACCOUNT_ID,
    phone: '+15553334444',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    address: '456 Maple Ave, Cambridge, MA 02139',
    notes: null,
    status: 'lead',
    source: 'inbound_call',
    interest_level: 'hot',
    lead_status: 'new',
    lead_notes: 'Interested in AC installation',
    lead_updated_at: hoursAgo(4),
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
  },
  {
    id: 'contact-003',
    account_id: DEMO_ACCOUNT_ID,
    phone: '+15554445555',
    name: 'Mike Williams',
    email: null,
    address: '789 Pine Road, Somerville, MA 02143',
    notes: null,
    status: 'lead',
    source: 'inbound_call',
    interest_level: 'warm',
    lead_status: 'contacted',
    lead_notes: 'Called back, scheduling next week',
    lead_updated_at: daysAgo(1),
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
  },
  {
    id: 'contact-004',
    account_id: DEMO_ACCOUNT_ID,
    phone: '+15555556666',
    name: 'Emily Davis',
    email: 'emily.d@email.com',
    address: '321 Birch Lane, Brookline, MA 02445',
    notes: 'Commercial property',
    status: 'customer',
    source: 'manual',
    interest_level: null,
    lead_status: 'converted',
    lead_notes: null,
    lead_updated_at: null,
    created_at: daysAgo(60),
    updated_at: daysAgo(10),
  },
  {
    id: 'contact-005',
    account_id: DEMO_ACCOUNT_ID,
    phone: '+15556667777',
    name: 'Robert Brown',
    email: null,
    address: null,
    notes: null,
    status: 'lead',
    source: 'inbound_call',
    interest_level: 'cold',
    lead_status: 'lost',
    lead_notes: 'Went with competitor',
    lead_updated_at: daysAgo(5),
    created_at: daysAgo(14),
    updated_at: daysAgo(5),
  },
];

// Demo Calls
export const mockCalls: Call[] = [
  {
    id: 'call-001',
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: 'phone-001',
    contact_id: 'contact-002',
    intake_id: 'intake-001',
    twilio_call_sid: 'CA123456789',
    elevenlabs_conversation_id: 'conv-001',
    caller_phone: '+15553334444',
    caller_name: 'Sarah Johnson',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 245,
    recording_url: null,
    summary: 'Customer called about AC not cooling properly. Scheduled service appointment for tomorrow morning.',
    is_emergency: false,
    started_at: hoursAgo(4),
    ended_at: hoursAgo(4),
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
    interest_level: 'hot',
    lead_status: 'new',
    lead_notes: null,
    lead_updated_at: null,
  },
  {
    id: 'call-002',
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: 'phone-001',
    contact_id: 'contact-003',
    intake_id: 'intake-002',
    twilio_call_sid: 'CA987654321',
    elevenlabs_conversation_id: 'conv-002',
    caller_phone: '+15554445555',
    caller_name: 'Mike Williams',
    status: 'completed',
    outcome: 'callback_requested',
    duration_seconds: 180,
    recording_url: null,
    summary: 'Customer inquired about furnace maintenance. Requested callback during business hours.',
    is_emergency: false,
    started_at: hoursAgo(26),
    ended_at: hoursAgo(26),
    created_at: hoursAgo(26),
    updated_at: hoursAgo(26),
    interest_level: 'warm',
    lead_status: 'new',
    lead_notes: null,
    lead_updated_at: null,
  },
  {
    id: 'call-003',
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: 'phone-001',
    contact_id: 'contact-001',
    intake_id: null,
    twilio_call_sid: 'CA456789123',
    elevenlabs_conversation_id: 'conv-003',
    caller_phone: '+15552223333',
    caller_name: 'John Smith',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 312,
    recording_url: null,
    summary: 'Returning customer scheduled annual HVAC maintenance check.',
    is_emergency: false,
    started_at: daysAgo(2),
    ended_at: daysAgo(2),
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    interest_level: 'hot',
    lead_status: 'converted',
    lead_notes: null,
    lead_updated_at: null,
  },
  {
    id: 'call-004',
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: 'phone-002',
    contact_id: null,
    intake_id: 'intake-003',
    twilio_call_sid: 'CA789123456',
    elevenlabs_conversation_id: 'conv-004',
    caller_phone: '+15558889999',
    caller_name: null,
    status: 'completed',
    outcome: 'escalated',
    duration_seconds: 95,
    recording_url: null,
    summary: 'Emergency call - no heat in home with elderly resident. Transferred to on-call technician.',
    is_emergency: true,
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    interest_level: 'hot',
    lead_status: 'new',
    lead_notes: null,
    lead_updated_at: null,
  },
  {
    id: 'call-005',
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: 'phone-001',
    contact_id: 'contact-005',
    intake_id: null,
    twilio_call_sid: 'CA321654987',
    elevenlabs_conversation_id: 'conv-005',
    caller_phone: '+15556667777',
    caller_name: 'Robert Brown',
    status: 'completed',
    outcome: 'information_provided',
    duration_seconds: 156,
    recording_url: null,
    summary: 'Customer asked about pricing for new furnace installation. Provided general pricing range.',
    is_emergency: false,
    started_at: daysAgo(5),
    ended_at: daysAgo(5),
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    interest_level: 'cold',
    lead_status: 'new',
    lead_notes: null,
    lead_updated_at: null,
  },
];

// Generate more calls for better chart data
const callerNames = [
  'Jennifer Lee', 'David Martinez', 'Amanda Wilson', 'Chris Taylor',
  'Lisa Anderson', 'Kevin Thompson', 'Maria Garcia', 'James Rodriguez',
  'Patricia White', 'Michael Brown', 'Linda Davis', 'Richard Miller',
  'Barbara Wilson', 'William Moore', 'Elizabeth Taylor', 'Joseph Anderson',
  'Susan Thomas', 'Charles Jackson', 'Jessica Harris', 'Daniel Martin',
  'Nancy Robinson', 'Matthew Clark', 'Karen Lewis', 'Anthony Walker',
  'Betty Hall', 'Mark Allen', 'Dorothy Young', 'Steven King',
  'Helen Wright', 'Paul Scott', 'Sandra Green', 'Andrew Adams',
];

const callSummaries: Record<string, string[]> = {
  booked: [
    'Customer scheduled AC tune-up for next week. Confirmed address and contact details.',
    'Booked furnace inspection appointment. Customer mentioned unusual noise when starting.',
    'Scheduled emergency repair visit for tomorrow morning. AC unit not cooling.',
    'Customer booked annual maintenance service. Returning customer from last year.',
    'Appointment set for duct cleaning service. Customer has allergy concerns.',
    'Scheduled heat pump installation consultation. Customer interested in energy savings.',
    'Booked thermostat replacement appointment. Old unit not responding properly.',
    'Customer scheduled HVAC diagnostic. System running but not heating efficiently.',
  ],
  callback_requested: [
    'Customer requested callback to discuss pricing options for new system.',
    'Caller wants to speak with a manager about service warranty. Scheduled callback.',
    'Customer needs time to check schedule. Will call back within 24 hours.',
    'Requested callback after consulting with spouse about repair vs replace decision.',
    'Customer at work, requested evening callback to discuss service options.',
    'Caller wants detailed quote for multi-zone system. Callback scheduled.',
  ],
  information_provided: [
    'Provided pricing information for AC installation. Customer will consider options.',
    'Explained maintenance plan benefits. Customer interested but needs more time.',
    'Answered questions about energy-efficient systems and available rebates.',
    'Provided service area information. Customer location confirmed within range.',
    'Explained emergency service availability and after-hours pricing.',
    'Discussed financing options for new HVAC system installation.',
  ],
  escalated: [
    'Emergency - No heat with infant in home. Transferred to on-call technician.',
    'Gas smell reported. Immediately transferred to emergency line.',
    'Customer reported smoke from vents. Escalated to emergency dispatch.',
    'Elderly resident with no AC during heat wave. Priority transfer completed.',
    'Commercial client with server room cooling failure. Urgent dispatch arranged.',
  ],
  no_action: [
    'Caller hung up before providing details.',
    'Wrong number - caller was looking for different business.',
    'Spam call detected and ended.',
    'Customer decided to handle issue themselves.',
    'Caller was inquiring about services we do not offer.',
  ],
};

// Generate 60 more calls with realistic data
for (let i = 6; i <= 65; i++) {
  const day = Math.floor(Math.random() * 30);
  const hour = Math.floor(Math.random() * 12) + 6; // Between 6am and 6pm
  const outcomes: Call['outcome'][] = ['booked', 'callback_requested', 'information_provided', 'escalated', 'no_action'];
  // Weight outcomes: more bookings and info, fewer escalations
  const weightedOutcomes: Call['outcome'][] = [
    'booked', 'booked', 'booked',
    'callback_requested', 'callback_requested',
    'information_provided', 'information_provided',
    'escalated',
    'no_action',
  ];
  const outcome = weightedOutcomes[Math.floor(Math.random() * weightedOutcomes.length)];
  const callerName = callerNames[Math.floor(Math.random() * callerNames.length)];
  const summaryOptions = callSummaries[outcome];
  const summary = summaryOptions[Math.floor(Math.random() * summaryOptions.length)];

  const callDate = new Date();
  callDate.setDate(callDate.getDate() - day);
  callDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

  mockCalls.push({
    id: `call-${String(i).padStart(3, '0')}`,
    account_id: DEMO_ACCOUNT_ID,
    phone_number_id: Math.random() > 0.3 ? 'phone-001' : 'phone-002',
    contact_id: null,
    intake_id: null,
    twilio_call_sid: `CA${Math.random().toString(36).substr(2, 9)}`,
    elevenlabs_conversation_id: `conv-${String(i).padStart(3, '0')}`,
    caller_phone: `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`,
    caller_name: Math.random() > 0.2 ? callerName : null, // 80% have names
    status: 'completed',
    outcome,
    duration_seconds: outcome === 'no_action'
      ? Math.floor(Math.random() * 30) + 5
      : Math.floor(Math.random() * 300) + 60,
    recording_url: null,
    summary,
    is_emergency: outcome === 'escalated',
    started_at: callDate.toISOString(),
    ended_at: callDate.toISOString(),
    created_at: callDate.toISOString(),
    updated_at: callDate.toISOString(),
    interest_level: outcome === 'booked' ? 'hot' : outcome === 'callback_requested' ? 'warm' : ['hot', 'warm', 'cold'][Math.floor(Math.random() * 3)] as Call['interest_level'],
    lead_status: outcome === 'booked' ? 'converted' : 'new',
    lead_notes: null,
    lead_updated_at: null,
  });
}

// Demo Services
export const mockServices = [
  {
    id: 'service-001',
    account_id: DEMO_ACCOUNT_ID,
    name: 'HVAC Diagnostic',
    description: 'Complete system diagnostic and inspection',
    price_cents: 9900,
    duration_minutes: 60,
    category: 'hvac',
    is_active: true,
    created_at: daysAgo(90),
  },
  {
    id: 'service-002',
    account_id: DEMO_ACCOUNT_ID,
    name: 'AC Tune-Up',
    description: 'Seasonal air conditioning maintenance',
    price_cents: 14900,
    duration_minutes: 90,
    category: 'hvac',
    is_active: true,
    created_at: daysAgo(90),
  },
  {
    id: 'service-003',
    account_id: DEMO_ACCOUNT_ID,
    name: 'Furnace Repair',
    description: 'Furnace troubleshooting and repair',
    price_cents: 19900,
    duration_minutes: 120,
    category: 'hvac',
    is_active: true,
    created_at: daysAgo(90),
  },
  {
    id: 'service-004',
    account_id: DEMO_ACCOUNT_ID,
    name: 'Emergency Service',
    description: '24/7 emergency HVAC service',
    price_cents: 29900,
    duration_minutes: 60,
    category: 'hvac',
    is_active: true,
    created_at: daysAgo(90),
  },
];

// Demo Appointments
export const mockAppointments: Appointment[] = [
  {
    id: 'apt-001',
    account_id: DEMO_ACCOUNT_ID,
    call_id: 'call-001',
    customer_name: 'Sarah Johnson',
    customer_phone: '+15553334444',
    customer_address: '456 Maple Ave, Cambridge, MA 02139',
    issue_description: 'AC not cooling properly',
    scheduled_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    scheduled_end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    notes: null,
    service_id: 'service-001',
    service_price_cents: 9900,
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
  },
  {
    id: 'apt-002',
    account_id: DEMO_ACCOUNT_ID,
    call_id: 'call-003',
    customer_name: 'John Smith',
    customer_phone: '+15552223333',
    customer_address: '123 Oak Street, Boston, MA 02101',
    issue_description: 'Annual HVAC maintenance',
    scheduled_start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    scheduled_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
    status: 'confirmed',
    notes: 'Regular customer - VIP service',
    service_id: 'service-002',
    service_price_cents: 14900,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
  },
  {
    id: 'apt-003',
    account_id: DEMO_ACCOUNT_ID,
    call_id: null,
    customer_name: 'Emily Davis',
    customer_phone: '+15555556666',
    customer_address: '321 Birch Lane, Brookline, MA 02445',
    issue_description: 'Commercial HVAC inspection',
    scheduled_start: daysAgo(1),
    scheduled_end: daysAgo(1),
    status: 'completed',
    notes: 'All systems operational',
    service_id: 'service-001',
    service_price_cents: 9900,
    created_at: daysAgo(5),
    updated_at: daysAgo(1),
  },
];

// Demo Subscription
export const mockSubscription: Subscription = {
  id: 'sub-001',
  account_id: DEMO_ACCOUNT_ID,
  stripe_customer_id: 'cus_demo123',
  stripe_subscription_id: 'sub_demo123',
  plan: 'pro',
  status: 'active',
  current_period_start: daysAgo(15),
  current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  cancel_at_period_end: false,
  created_at: daysAgo(45),
  updated_at: daysAgo(15),
};

// Demo Call Intakes
export const mockCallIntakes: CallIntake[] = [
  {
    id: 'intake-001',
    account_id: DEMO_ACCOUNT_ID,
    call_id: 'call-001',
    contact_id: 'contact-002',
    caller_name: 'Sarah Johnson',
    caller_phone: '+15553334444',
    caller_address: '456 Maple Ave, Cambridge, MA 02139',
    caller_zip: '02139',
    service_category: 'hvac',
    issue_description: 'AC unit not cooling. Started yesterday. Making unusual noise.',
    urgency: 'high',
    is_emergency: false,
    emergency_keywords: null,
    was_transferred: false,
    transferred_to_phone: null,
    transferred_to_name: null,
    transfer_accepted: null,
    callback_requested: false,
    callback_scheduled_for: null,
    callback_completed_at: null,
    callback_notes: null,
    extraction_confidence: 0.95,
    raw_transcript: null,
    created_at: hoursAgo(4),
    updated_at: hoursAgo(4),
  },
  {
    id: 'intake-002',
    account_id: DEMO_ACCOUNT_ID,
    call_id: 'call-002',
    contact_id: 'contact-003',
    caller_name: 'Mike Williams',
    caller_phone: '+15554445555',
    caller_address: '789 Pine Road, Somerville, MA 02143',
    caller_zip: '02143',
    service_category: 'hvac',
    issue_description: 'Furnace maintenance before winter season',
    urgency: 'normal',
    is_emergency: false,
    emergency_keywords: null,
    was_transferred: false,
    transferred_to_phone: null,
    transferred_to_name: null,
    transfer_accepted: null,
    callback_requested: true,
    callback_scheduled_for: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    callback_completed_at: null,
    callback_notes: null,
    extraction_confidence: 0.88,
    raw_transcript: null,
    created_at: hoursAgo(26),
    updated_at: hoursAgo(26),
  },
  {
    id: 'intake-003',
    account_id: DEMO_ACCOUNT_ID,
    call_id: 'call-004',
    contact_id: null,
    caller_name: null,
    caller_phone: '+15558889999',
    caller_address: null,
    caller_zip: null,
    service_category: 'hvac',
    issue_description: 'No heat - elderly resident in home',
    urgency: 'emergency',
    is_emergency: true,
    emergency_keywords: ['no heat', 'elderly'],
    was_transferred: true,
    transferred_to_phone: '+15551112222',
    transferred_to_name: 'On-Call Tech',
    transfer_accepted: true,
    callback_requested: false,
    callback_scheduled_for: null,
    callback_completed_at: null,
    callback_notes: null,
    extraction_confidence: 0.92,
    raw_transcript: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  },
];

// Dashboard stats generator
export function generateMockDashboardStats(period: '7d' | '30d' | '3m' | '6m') {
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '3m' ? 90 : 180;

  const periodCalls = mockCalls.filter(c => {
    const callDate = new Date(c.started_at);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    return callDate >= cutoff;
  });

  const bookedCalls = periodCalls.filter(c => c.outcome === 'booked').length;

  // Generate chart data
  const chartData: Array<{ name: string; calls: number; revenue: number }> = [];

  if (period === '7d') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      chartData.push({
        name: dayNames[date.getDay()],
        calls: Math.floor(Math.random() * 8) + 2,
        revenue: Math.floor(Math.random() * 500) + 100,
      });
    }
  } else if (period === '30d') {
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 5));
      chartData.push({
        name: `${date.getMonth() + 1}/${date.getDate()}`,
        calls: Math.floor(Math.random() * 25) + 10,
        revenue: Math.floor(Math.random() * 1500) + 500,
      });
    }
  } else {
    const weeks = period === '3m' ? 12 : 24;
    for (let i = weeks - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      chartData.push({
        name: `${date.getMonth() + 1}/${date.getDate()}`,
        calls: Math.floor(Math.random() * 35) + 15,
        revenue: Math.floor(Math.random() * 2500) + 800,
      });
    }
  }

  return {
    total_calls: periodCalls.length,
    appointments_booked: bookedCalls,
    revenue_estimate: bookedCalls * 149, // Average service price
    calls_trend: Math.floor(Math.random() * 40) - 10,
    bookings_trend: Math.floor(Math.random() * 30) - 5,
    revenue_trend: Math.floor(Math.random() * 35) - 8,
    chart_data: chartData,
  };
}
