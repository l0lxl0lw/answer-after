// AnswerAfter Database Schema Types
// These types match the PostgreSQL schema

// ============= Enums =============

export type UserRole = 'owner' | 'admin' | 'staff';

// Database call_status enum
export type CallStatus = 
  | 'active'
  | 'completed'
  | 'failed'
  | 'voicemail';

// Database call_outcome enum
export type CallOutcome = 
  | 'booked'
  | 'callback_requested'
  | 'information_provided'
  | 'escalated'
  | 'no_action'
  | 'voicemail';

// Database appointment_status enum
export type AppointmentStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'pending';

export type SubscriptionPlan = 'core' | 'growth' | 'pro' | 'business' | 'enterprise';

export type AuditAction = 
  | 'call.created'
  | 'call.completed'
  | 'call.failed'
  | 'appointment.created'
  | 'appointment.updated'
  | 'user.created'
  | 'user.updated'
  | 'settings.updated'
  | 'subscription.updated';

// ============= Core Entities =============

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  business_hours_start: string | null; // HH:MM format
  business_hours_end: string | null;   // HH:MM format
  notification_email: string | null;
  notification_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole_Record {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface PhoneNumber {
  id: string;
  organization_id: string;
  twilio_sid: string | null;
  phone_number: string; // E.164 format
  friendly_name: string | null;
  is_active: boolean;
  is_after_hours_only: boolean;
  created_at: string;
  updated_at: string;
}

// ============= Call Management =============

export interface Call {
  id: string;
  organization_id: string;
  phone_number_id: string | null;
  twilio_call_sid: string | null;
  caller_phone: string;
  caller_name: string | null;
  status: CallStatus;
  outcome: CallOutcome | null;
  duration_seconds: number | null;
  recording_url: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallEvent {
  id: string;
  call_id: string;
  event_type: string;
  event_data: unknown;
  ai_prompt: string | null;
  ai_response: string | null;
  created_at: string;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  speaker: string;
  content: string;
  confidence: number | null;
  timestamp_ms: number | null;
  created_at: string;
}

// ============= Appointments =============

export interface Appointment {
  id: string;
  organization_id: string;
  call_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  issue_description: string;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============= Billing =============

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// ============= Audit & Logging =============

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============= Computed/View Types =============

export interface CallWithDetails extends Call {
  phone_number: PhoneNumber | null;
  events: CallEvent[];
  transcripts: CallTranscript[];
  appointment?: Appointment;
}

export interface OrganizationWithSubscription extends Organization {
  subscription: Subscription | null;
  phone_numbers: PhoneNumber[];
  user_count: number;
}

// ============= Dashboard Analytics =============

export interface DashboardStats {
  total_calls_today: number;
  total_calls_week: number;
  total_calls_month?: number;
  appointments_booked_today: number;
  average_call_duration: number;
  answer_rate: number;
  revenue_captured_estimate: number;
}

export interface CallsByHour {
  hour: number;
  count: number;
}

export interface CallsByOutcome {
  outcome: CallOutcome;
  count: number;
  percentage: number;
}
