// AnswerAfter Mock Data
// Realistic mock data for development without backend

import type {
  Organization,
  User,
  UserRole,
  PhoneNumber,
  Call,
  CallWithDetails,
  CallEvent,
  CallTranscript,
  Technician,
  TechnicianWithSchedule,
  OnCallSchedule,
  Appointment,
  Subscription,
  DashboardStats,
  CallsByHour,
  CallsByOutcome,
  AuditLog,
} from '@/types/database';

// ============= Organization =============

export const mockOrganization: Organization = {
  id: 'org_01',
  name: 'Comfort Zone HVAC',
  slug: 'comfort-zone-hvac',
  timezone: 'America/Chicago',
  business_hours_start: '08:00',
  business_hours_end: '17:00',
  notification_email: 'owner@comfortzonehvac.com',
  notification_phone: '+15551234567',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-12-01T14:30:00Z',
};

// ============= Users =============

export const mockUsers: User[] = [
  {
    id: 'user_01',
    organization_id: 'org_01',
    email: 'mike@comfortzonehvac.com',
    full_name: 'Mike Thompson',
    phone: '+15551234567',
    avatar_url: null,
    is_active: true,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-12-01T14:30:00Z',
  },
  {
    id: 'user_02',
    organization_id: 'org_01',
    email: 'sarah@comfortzonehvac.com',
    full_name: 'Sarah Chen',
    phone: '+15559876543',
    avatar_url: null,
    is_active: true,
    created_at: '2024-03-01T09:00:00Z',
    updated_at: '2024-11-15T11:00:00Z',
  },
  {
    id: 'user_03',
    organization_id: 'org_01',
    email: 'james@comfortzonehvac.com',
    full_name: 'James Wilson',
    phone: '+15555551234',
    avatar_url: null,
    is_active: true,
    created_at: '2024-06-01T08:00:00Z',
    updated_at: '2024-10-20T16:00:00Z',
  },
];

export const mockUserRoles: Record<string, UserRole> = {
  user_01: 'owner',
  user_02: 'admin',
  user_03: 'staff',
};

// ============= Phone Numbers =============

export const mockPhoneNumbers: PhoneNumber[] = [
  {
    id: 'phone_01',
    organization_id: 'org_01',
    twilio_sid: 'PN1234567890abcdef',
    phone_number: '+15552223333',
    friendly_name: 'Main After-Hours Line',
    is_active: true,
    is_after_hours_only: true,
    created_at: '2024-01-20T12:00:00Z',
    updated_at: '2024-01-20T12:00:00Z',
  },
  {
    id: 'phone_02',
    organization_id: 'org_01',
    twilio_sid: 'PN0987654321fedcba',
    phone_number: '+15554445555',
    friendly_name: 'Overflow Line',
    is_active: true,
    is_after_hours_only: false,
    created_at: '2024-06-15T09:00:00Z',
    updated_at: '2024-06-15T09:00:00Z',
  },
];

// ============= Technicians =============

export const mockTechnicians: Technician[] = [
  {
    id: 'tech_01',
    organization_id: 'org_01',
    user_id: 'user_03',
    full_name: 'James Wilson',
    phone: '+15555551234',
    email: 'james@comfortzonehvac.com',
    specializations: ['Heating', 'Cooling', 'Maintenance'],
    is_active: true,
    created_at: '2024-06-01T08:00:00Z',
    updated_at: '2024-10-20T16:00:00Z',
  },
  {
    id: 'tech_02',
    organization_id: 'org_01',
    user_id: null,
    full_name: 'Roberto Martinez',
    phone: '+15556667777',
    email: 'roberto.martinez@email.com',
    specializations: ['Heating', 'Gas', 'Installation'],
    is_active: true,
    created_at: '2024-02-15T10:00:00Z',
    updated_at: '2024-09-10T14:00:00Z',
  },
  {
    id: 'tech_03',
    organization_id: 'org_01',
    user_id: null,
    full_name: 'Amy Rodriguez',
    phone: '+15558889999',
    email: 'amy.rodriguez@email.com',
    specializations: ['Cooling', 'Maintenance'],
    is_active: true,
    created_at: '2024-04-01T11:00:00Z',
    updated_at: '2024-08-25T09:00:00Z',
  },
];

// ============= Schedules =============

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

export const mockSchedules: OnCallSchedule[] = [
  {
    id: 'schedule_01',
    organization_id: 'org_01',
    technician_id: 'tech_01',
    start_datetime: new Date(today.setHours(17, 0, 0, 0)).toISOString(),
    end_datetime: new Date(tomorrow.setHours(8, 0, 0, 0)).toISOString(),
    is_primary: true,
    notes: 'Primary on-call tonight',
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z',
  },
  {
    id: 'schedule_02',
    organization_id: 'org_01',
    technician_id: 'tech_02',
    start_datetime: new Date(today.setHours(17, 0, 0, 0)).toISOString(),
    end_datetime: new Date(tomorrow.setHours(8, 0, 0, 0)).toISOString(),
    is_primary: false,
    notes: 'Backup if James unavailable',
    created_at: '2024-12-15T10:00:00Z',
    updated_at: '2024-12-15T10:00:00Z',
  },
];

// ============= Calls =============

const callTimes = [
  new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
  new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
  new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
  new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
];

export const mockCalls: Call[] = [
  {
    id: 'call_01',
    organization_id: 'org_01',
    phone_number_id: 'phone_01',
    twilio_call_sid: 'CA1234567890abcdef01',
    caller_phone: '+15559991111',
    caller_name: 'David Johnson',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 245,
    recording_url: 'https://api.twilio.com/recordings/RE123',
    summary: 'Complete heating failure. Technician James Wilson scheduled for tomorrow morning.',
    started_at: callTimes[0].toISOString(),
    ended_at: new Date(callTimes[0].getTime() + 245000).toISOString(),
    created_at: callTimes[0].toISOString(),
    updated_at: callTimes[0].toISOString(),
  },
  {
    id: 'call_02',
    organization_id: 'org_01',
    phone_number_id: 'phone_01',
    twilio_call_sid: 'CA1234567890abcdef02',
    caller_phone: '+15558882222',
    caller_name: 'Lisa Park',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 180,
    recording_url: 'https://api.twilio.com/recordings/RE124',
    summary: 'Routine service request: AC making unusual noise. Appointment scheduled for tomorrow 10am.',
    started_at: callTimes[1].toISOString(),
    ended_at: new Date(callTimes[1].getTime() + 180000).toISOString(),
    created_at: callTimes[1].toISOString(),
    updated_at: callTimes[1].toISOString(),
  },
  {
    id: 'call_03',
    organization_id: 'org_01',
    phone_number_id: 'phone_01',
    twilio_call_sid: 'CA1234567890abcdef03',
    caller_phone: '+15557773333',
    caller_name: null,
    status: 'completed',
    outcome: 'callback_requested',
    duration_seconds: 95,
    recording_url: 'https://api.twilio.com/recordings/RE125',
    summary: 'Customer inquiring about maintenance plan pricing. Left message for callback during business hours.',
    started_at: callTimes[2].toISOString(),
    ended_at: new Date(callTimes[2].getTime() + 95000).toISOString(),
    created_at: callTimes[2].toISOString(),
    updated_at: callTimes[2].toISOString(),
  },
  {
    id: 'call_04',
    organization_id: 'org_01',
    phone_number_id: 'phone_01',
    twilio_call_sid: 'CA1234567890abcdef04',
    caller_phone: '+15556664444',
    caller_name: 'Mark Stevens',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 312,
    recording_url: 'https://api.twilio.com/recordings/RE126',
    summary: 'Furnace inspection requested. Technician Roberto Martinez scheduled.',
    started_at: callTimes[3].toISOString(),
    ended_at: new Date(callTimes[3].getTime() + 312000).toISOString(),
    created_at: callTimes[3].toISOString(),
    updated_at: callTimes[3].toISOString(),
  },
  {
    id: 'call_05',
    organization_id: 'org_01',
    phone_number_id: 'phone_01',
    twilio_call_sid: 'CA1234567890abcdef05',
    caller_phone: '+15555555555',
    caller_name: 'Jennifer Adams',
    status: 'completed',
    outcome: 'booked',
    duration_seconds: 156,
    recording_url: 'https://api.twilio.com/recordings/RE127',
    summary: 'Furnace not starting. Customer tried resetting. Scheduled for next available slot.',
    started_at: callTimes[4].toISOString(),
    ended_at: new Date(callTimes[4].getTime() + 156000).toISOString(),
    created_at: callTimes[4].toISOString(),
    updated_at: callTimes[4].toISOString(),
  },
];

// ============= Call Events (for call_01) =============

export const mockCallEvents: CallEvent[] = [
  {
    id: 'event_01',
    call_id: 'call_01',
    event_type: 'initiated',
    event_data: { from: '+15559991111', to: '+15552223333' },
    ai_prompt: null,
    ai_response: null,
    created_at: callTimes[0].toISOString(),
  },
  {
    id: 'event_02',
    call_id: 'call_01',
    event_type: 'greeting',
    event_data: {},
    ai_prompt: 'Generate professional after-hours greeting for HVAC company.',
    ai_response: 'Thank you for calling Comfort Zone HVAC after-hours line. My name is Alex, and I\'m here to help you. Are you calling about a heating or cooling issue?',
    created_at: new Date(callTimes[0].getTime() + 2000).toISOString(),
  },
  {
    id: 'event_03',
    call_id: 'call_01',
    event_type: 'qualification',
    event_data: { detected_issue: 'heating_failure' },
    ai_prompt: 'Ask qualifying questions about heating issue.',
    ai_response: 'I understand your heat isn\'t working. Can you tell me more about the issue? When did you first notice the problem?',
    created_at: new Date(callTimes[0].getTime() + 45000).toISOString(),
  },
  {
    id: 'event_04',
    call_id: 'call_01',
    event_type: 'appointment_booked',
    event_data: { appointment_date: 'tomorrow_morning' },
    ai_prompt: 'Schedule appointment for heating issue.',
    ai_response: 'I\'ve scheduled our technician James to come by tomorrow morning between 8-10am. He\'ll give you a call when he\'s on his way. Can I confirm your address?',
    created_at: new Date(callTimes[0].getTime() + 120000).toISOString(),
  },
  {
    id: 'event_05',
    call_id: 'call_01',
    event_type: 'dispatched',
    event_data: { technician_id: 'tech_01', scheduled_for: 'tomorrow_morning' },
    ai_prompt: null,
    ai_response: 'James Wilson has been scheduled for tomorrow morning. He will call you when he\'s on his way. Is there anything else I can help you with?',
    created_at: new Date(callTimes[0].getTime() + 180000).toISOString(),
  },
  {
    id: 'event_06',
    call_id: 'call_01',
    event_type: 'completed',
    event_data: { duration: 245, outcome: 'booked' },
    ai_prompt: null,
    ai_response: 'Thank you for calling Comfort Zone HVAC. James is scheduled for tomorrow morning. Have a great evening!',
    created_at: new Date(callTimes[0].getTime() + 240000).toISOString(),
  },
];

// ============= Call Transcripts (for call_01) =============

export const mockCallTranscripts: CallTranscript[] = [
  {
    id: 'trans_01',
    call_id: 'call_01',
    speaker: 'ai',
    content: 'Thank you for calling Comfort Zone HVAC after-hours line. My name is Alex, and I\'m here to help you. Are you calling about a heating or cooling issue?',
    confidence: 1.0,
    timestamp_ms: 2000,
    created_at: new Date(callTimes[0].getTime() + 2000).toISOString(),
  },
  {
    id: 'trans_02',
    call_id: 'call_01',
    speaker: 'caller',
    content: 'Yes, hi. My heat just completely stopped working. It\'s freezing in here.',
    confidence: 0.95,
    timestamp_ms: 8000,
    created_at: new Date(callTimes[0].getTime() + 8000).toISOString(),
  },
  {
    id: 'trans_03',
    call_id: 'call_01',
    speaker: 'ai',
    content: 'I understand your heat isn\'t working. Can you tell me more about the issue? When did you first notice the problem?',
    confidence: 1.0,
    timestamp_ms: 15000,
    created_at: new Date(callTimes[0].getTime() + 15000).toISOString(),
  },
  {
    id: 'trans_04',
    call_id: 'call_01',
    speaker: 'caller',
    content: 'It just stopped working about an hour ago. We tried resetting it but nothing happened.',
    confidence: 0.93,
    timestamp_ms: 25000,
    created_at: new Date(callTimes[0].getTime() + 25000).toISOString(),
  },
  {
    id: 'trans_05',
    call_id: 'call_01',
    speaker: 'ai',
    content: 'I understand. I\'ve scheduled our technician James to come by tomorrow morning between 8-10am. He\'ll give you a call when he\'s on his way. Can I confirm your address?',
    confidence: 1.0,
    timestamp_ms: 35000,
    created_at: new Date(callTimes[0].getTime() + 35000).toISOString(),
  },
  {
    id: 'trans_06',
    call_id: 'call_01',
    speaker: 'caller',
    content: '1847 Oak Street, the white house on the corner.',
    confidence: 0.97,
    timestamp_ms: 45000,
    created_at: new Date(callTimes[0].getTime() + 45000).toISOString(),
  },
  {
    id: 'trans_07',
    call_id: 'call_01',
    speaker: 'ai',
    content: 'Perfect, 1847 Oak Street. James Wilson has been scheduled for tomorrow morning between 8-10am. He will call you when he\'s on his way. Is there anything else I can help you with?',
    confidence: 1.0,
    timestamp_ms: 55000,
    created_at: new Date(callTimes[0].getTime() + 55000).toISOString(),
  },
  {
    id: 'trans_08',
    call_id: 'call_01',
    speaker: 'caller',
    content: 'No, that\'s great. Thank you so much for getting someone out so quickly.',
    confidence: 0.96,
    timestamp_ms: 65000,
    created_at: new Date(callTimes[0].getTime() + 65000).toISOString(),
  },
  {
    id: 'trans_09',
    call_id: 'call_01',
    speaker: 'ai',
    content: 'Thank you for calling Comfort Zone HVAC. James is scheduled for tomorrow morning. Have a great evening!',
    confidence: 1.0,
    timestamp_ms: 75000,
    created_at: new Date(callTimes[0].getTime() + 75000).toISOString(),
  },
];

// ============= Call With Details =============

export const mockCallWithDetails: CallWithDetails = {
  ...mockCalls[0],
  phone_number: mockPhoneNumbers[0],
  events: mockCallEvents,
  transcripts: mockCallTranscripts,
  appointment: undefined,
};

// ============= Technicians With Schedules =============

export const mockTechniciansWithSchedules: TechnicianWithSchedule[] = mockTechnicians.map(tech => ({
  ...tech,
  schedules: mockSchedules.filter(s => s.technician_id === tech.id),
  user: mockUsers.find(u => u.id === tech.user_id),
}));

// ============= Appointments =============

export const mockAppointments: Appointment[] = [
  {
    id: 'apt_01',
    organization_id: 'org_01',
    call_id: 'call_02',
    technician_id: 'tech_03',
    customer_name: 'Lisa Park',
    customer_phone: '+15558882222',
    customer_address: '2456 Maple Avenue',
    issue_description: 'AC making unusual noise',
    scheduled_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    scheduled_end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    notes: 'Customer prefers morning appointment',
    created_at: callTimes[1].toISOString(),
    updated_at: callTimes[1].toISOString(),
  },
  {
    id: 'apt_02',
    organization_id: 'org_01',
    call_id: 'call_05',
    technician_id: 'tech_01',
    customer_name: 'Jennifer Adams',
    customer_phone: '+15555555555',
    customer_address: '789 Pine Street',
    issue_description: 'Furnace not starting',
    scheduled_start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    scheduled_end: new Date(Date.now() + 48 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    notes: null,
    created_at: callTimes[4].toISOString(),
    updated_at: callTimes[4].toISOString(),
  },
];

// ============= Subscription =============

export const mockSubscription: Subscription = {
  id: 'sub_01',
  organization_id: 'org_01',
  stripe_customer_id: 'cus_1234567890',
  stripe_subscription_id: 'sub_1234567890',
  plan: 'professional',
  status: 'active',
  current_period_start: '2024-12-01T00:00:00Z',
  current_period_end: '2025-01-01T00:00:00Z',
  cancel_at_period_end: false,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-12-01T00:00:00Z',
};

// ============= Dashboard Stats =============

export const mockDashboardStats: DashboardStats = {
  total_calls_today: 12,
  total_calls_week: 47,
  total_calls_month: 186,
  appointments_booked_today: 4,
  technicians_dispatched_today: 2,
  average_call_duration: 178,
  answer_rate: 98.5,
  revenue_captured_estimate: 2450,
};

export const mockCallsByHour: CallsByHour[] = [
  { hour: 17, count: 3 },
  { hour: 18, count: 5 },
  { hour: 19, count: 4 },
  { hour: 20, count: 6 },
  { hour: 21, count: 8 },
  { hour: 22, count: 5 },
  { hour: 23, count: 3 },
  { hour: 0, count: 2 },
  { hour: 1, count: 1 },
  { hour: 2, count: 1 },
  { hour: 3, count: 0 },
  { hour: 4, count: 1 },
  { hour: 5, count: 2 },
  { hour: 6, count: 3 },
  { hour: 7, count: 3 },
];

export const mockCallsByOutcome: CallsByOutcome[] = [
  { outcome: 'booked', count: 36, percentage: 77 },
  { outcome: 'callback_requested', count: 8, percentage: 17 },
  { outcome: 'escalated', count: 2, percentage: 4 },
  { outcome: 'no_action', count: 1, percentage: 2 },
];

// ============= Audit Logs =============

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit_01',
    organization_id: 'org_01',
    user_id: 'user_01',
    action: 'call.completed',
    resource_type: 'call',
    resource_id: 'call_01',
    old_value: null,
    new_value: { outcome: 'dispatched', technician_id: 'tech_01' },
    ip_address: null,
    user_agent: null,
    created_at: callTimes[0].toISOString(),
  },
  {
    id: 'audit_02',
    organization_id: 'org_01',
    user_id: 'user_01',
    action: 'technician.dispatched',
    resource_type: 'technician',
    resource_id: 'tech_01',
    old_value: null,
    new_value: { call_id: 'call_01', dispatched_at: callTimes[0].toISOString() },
    ip_address: null,
    user_agent: null,
    created_at: callTimes[0].toISOString(),
  },
  {
    id: 'audit_03',
    organization_id: 'org_01',
    user_id: 'user_02',
    action: 'appointment.created',
    resource_type: 'appointment',
    resource_id: 'apt_01',
    old_value: null,
    new_value: { customer_name: 'Lisa Park', scheduled_start: mockAppointments[0].scheduled_start },
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0...',
    created_at: callTimes[1].toISOString(),
  },
];
