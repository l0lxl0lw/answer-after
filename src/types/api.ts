// AnswerAfter API Contract Types
// Request/Response schemas for Express API

import type {
  Account,
  User,
  UserRole,
  PhoneNumber,
  Call,
  CallWithDetails,
  CallEvent,
  Appointment,
  Subscription,
  SubscriptionPlan,
  DashboardStats,
  CallsByHour,
  CallsByOutcome,
  AuditLog,
} from './database';

// ============= Common Types =============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface DateRangeParams {
  start_date?: string;
  end_date?: string;
}

// ============= Auth Endpoints =============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  role: UserRole;
  account: Account;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  account_name: string;
  phone?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_at: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

// ============= Account Endpoints =============

export interface UpdateAccountRequest {
  name?: string;
  timezone?: string;
  business_hours_start?: string;
  business_hours_end?: string;
  notification_email?: string;
  notification_phone?: string;
}

// ============= User Endpoints =============

export interface CreateUserRequest {
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  is_active?: boolean;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

// ============= Phone Number Endpoints =============

export interface CreatePhoneNumberRequest {
  area_code: string;
  friendly_name: string;
  is_after_hours_only?: boolean;
}

export interface UpdatePhoneNumberRequest {
  friendly_name?: string;
  is_active?: boolean;
  is_after_hours_only?: boolean;
}

export interface AvailablePhoneNumber {
  phone_number: string;
  friendly_name: string;
  locality: string;
  region: string;
}

// ============= Call Endpoints =============

export interface CallListParams extends PaginationParams, DateRangeParams {
  status?: string;
  outcome?: string;
  phone_number_id?: string;
  search?: string;
}

export interface CallListResponse {
  calls: Call[];
  meta: PaginationMeta;
}

// Twilio webhook payloads
export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  CallerName?: string;
}

export interface TwilioStatusCallback {
  CallSid: string;
  CallStatus: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
}

// ============= Appointment Endpoints =============

export interface CreateAppointmentRequest {
  call_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  issue_description: string;
  scheduled_start: string;
  scheduled_end: string;
  notes?: string;
}

export interface UpdateAppointmentRequest {
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  issue_description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  status?: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

export interface AppointmentListParams extends PaginationParams, DateRangeParams {
  status?: string;
}

// ============= Subscription Endpoints =============

export interface CreateCheckoutSessionRequest {
  plan: SubscriptionPlan;
  success_url: string;
  cancel_url: string;
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface CreatePortalSessionRequest {
  return_url: string;
}

export interface CreatePortalSessionResponse {
  portal_url: string;
}

// Stripe webhook payloads
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ============= Reports Endpoints =============

export interface DailyReportParams {
  date?: string; // YYYY-MM-DD, defaults to today
}

export interface DailyReportResponse {
  date: string;
  stats: DashboardStats;
  calls_by_hour: CallsByHour[];
  calls_by_outcome: CallsByOutcome[];
  top_issues: { issue: string; count: number }[];
  notable_calls: Call[];
}

export interface WeeklyReportParams {
  week_start?: string; // YYYY-MM-DD
}

export interface MonthlyReportParams {
  year: number;
  month: number;
}

// ============= Audit Log Endpoints =============

export interface AuditLogListParams extends PaginationParams, DateRangeParams {
  action?: string;
  user_id?: string;
  resource_type?: string;
}

// ============= API Endpoint Definitions =============

export interface ApiEndpoints {
  // Auth
  'POST /auth/login': { request: LoginRequest; response: LoginResponse };
  'POST /auth/register': { request: RegisterRequest; response: LoginResponse };
  'POST /auth/refresh': { request: RefreshTokenRequest; response: RefreshTokenResponse };
  'POST /auth/forgot-password': { request: ForgotPasswordRequest; response: void };
  'POST /auth/reset-password': { request: ResetPasswordRequest; response: void };
  'POST /auth/logout': { request: void; response: void };
  
  // Account
  'GET /accounts/:id': { request: void; response: Account };
  'PATCH /accounts/:id': { request: UpdateAccountRequest; response: Account };
  
  // Users
  'GET /users': { request: PaginationParams; response: { users: User[]; meta: PaginationMeta } };
  'GET /users/:id': { request: void; response: User };
  'POST /users': { request: CreateUserRequest; response: User };
  'PATCH /users/:id': { request: UpdateUserRequest; response: User };
  'DELETE /users/:id': { request: void; response: void };
  'PATCH /users/:id/role': { request: UpdateUserRoleRequest; response: void };
  
  // Phone Numbers
  'GET /phone-numbers': { request: void; response: PhoneNumber[] };
  'GET /phone-numbers/available': { request: { area_code: string }; response: AvailablePhoneNumber[] };
  'POST /phone-numbers': { request: CreatePhoneNumberRequest; response: PhoneNumber };
  'PATCH /phone-numbers/:id': { request: UpdatePhoneNumberRequest; response: PhoneNumber };
  'DELETE /phone-numbers/:id': { request: void; response: void };
  
  // Calls
  'GET /calls': { request: CallListParams; response: CallListResponse };
  'GET /calls/:id': { request: void; response: CallWithDetails };
  'POST /calls/webhook/twilio': { request: TwilioVoiceWebhook; response: string }; // TwiML
  'POST /calls/webhook/twilio/status': { request: TwilioStatusCallback; response: void };
  
  // Appointments
  'GET /appointments': { request: AppointmentListParams; response: { appointments: Appointment[]; meta: PaginationMeta } };
  'GET /appointments/:id': { request: void; response: Appointment };
  'POST /appointments': { request: CreateAppointmentRequest; response: Appointment };
  'PATCH /appointments/:id': { request: UpdateAppointmentRequest; response: Appointment };
  'DELETE /appointments/:id': { request: void; response: void };
  
  // Subscription
  'GET /subscription': { request: void; response: Subscription | null };
  'POST /subscription/checkout': { request: CreateCheckoutSessionRequest; response: CreateCheckoutSessionResponse };
  'POST /subscription/portal': { request: CreatePortalSessionRequest; response: CreatePortalSessionResponse };
  'POST /subscription/webhook/stripe': { request: StripeWebhookEvent; response: void };
  
  // Reports
  'GET /reports/dashboard': { request: void; response: DashboardStats };
  'GET /reports/daily': { request: DailyReportParams; response: DailyReportResponse };
  'GET /reports/weekly': { request: WeeklyReportParams; response: DailyReportResponse };
  'GET /reports/monthly': { request: MonthlyReportParams; response: DailyReportResponse };
  
  // Audit Logs
  'GET /audit-logs': { request: AuditLogListParams; response: { logs: AuditLog[]; meta: PaginationMeta } };
}
