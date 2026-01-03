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

// Database interest_level enum (for leads)
export type InterestLevel = 'hot' | 'warm' | 'cold';

// Database lead_status enum
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';

// Database contact_status enum
export type ContactStatus = 'lead' | 'customer';

// Database contact_source enum
export type ContactSource = 'inbound_call' | 'manual' | 'import';

// Database appointment_status enum
export type AppointmentStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'pending';

export type SubscriptionPlan = 'starter' | 'pro' | 'business' | 'enterprise';

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

// Lead recovery enums
export type IntakeUrgency = 'low' | 'normal' | 'high' | 'emergency';

export type IntakeCategory =
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'roofing'
  | 'appliance'
  | 'locksmith'
  | 'pest_control'
  | 'general';


// ============= Core Entities =============

export interface WorkflowConfig {
  emergency_keywords?: string[];
  service_categories?: string[];
  transfer_enabled?: boolean;
  callback_hours_offset?: number;
}

export interface Account {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  business_hours_start: string | null; // HH:MM format
  business_hours_end: string | null;   // HH:MM format
  notification_email: string | null;
  notification_phone: string | null;
  workflow_config: WorkflowConfig | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  account_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface PhoneNumber {
  id: string;
  account_id: string;
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
  account_id: string;
  phone_number_id: string | null;
  contact_id: string | null;
  intake_id: string | null;
  twilio_call_sid: string | null;
  elevenlabs_conversation_id: string | null;
  caller_phone: string;
  caller_name: string | null;
  status: CallStatus;
  outcome: CallOutcome | null;
  duration_seconds: number | null;
  recording_url: string | null;
  summary: string | null;
  is_emergency: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  // Legacy lead tracking fields (now on contacts table)
  interest_level: InterestLevel | null;
  lead_status: LeadStatus;
  lead_notes: string | null;
  lead_updated_at: string | null;
}

// ============= Contacts (Unified Leads & Customers) =============

export interface Contact {
  id: string;
  account_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ContactStatus;
  source: ContactSource;
  // Lead-specific fields
  interest_level: InterestLevel | null;
  lead_status: LeadStatus;
  lead_notes: string | null;
  lead_updated_at: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Lead type (contact with status='lead')
export interface Lead extends Contact {
  status: 'lead';
}

// Customer type (contact with status='customer')
export interface Customer extends Contact {
  status: 'customer';
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

// ============= Lead Recovery =============

export interface CallIntake {
  id: string;
  account_id: string;
  call_id: string | null;
  contact_id: string | null;
  caller_name: string | null;
  caller_phone: string;
  caller_address: string | null;
  caller_zip: string | null;
  service_category: IntakeCategory | null;
  issue_description: string | null;
  urgency: IntakeUrgency;
  is_emergency: boolean;
  emergency_keywords: string[] | null;
  was_transferred: boolean;
  transferred_to_phone: string | null;
  transferred_to_name: string | null;
  transfer_accepted: boolean | null;
  callback_requested: boolean;
  callback_scheduled_for: string | null;
  callback_completed_at: string | null;
  callback_notes: string | null;
  extraction_confidence: number | null;
  raw_transcript: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallIntakeWithContact extends CallIntake {
  contact: Contact | null;
  call: Call | null;
}

// ============= Appointments =============

export interface Appointment {
  id: string;
  account_id: string;
  call_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  issue_description: string;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  notes: string | null;
  // Service tracking for gross production reporting
  service_id: string | null;
  service_price_cents: number | null;
  created_at: string;
  updated_at: string;
}

// ============= Billing =============

export interface Subscription {
  id: string;
  account_id: string;
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
  account_id: string;
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

export interface AccountWithSubscription extends Account {
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

// ============= Knowledge Base =============

export interface KnowledgeBaseDocument {
  id: string;
  account_id: string;
  elevenlabs_document_id: string;
  name: string;
  file_size_bytes: number | null;
  created_at: string;
}
