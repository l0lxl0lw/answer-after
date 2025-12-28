/**
 * Shared TypeScript types for Edge Functions
 * Provides type safety and consistency across all functions
 */

// ============================================
// Organization Types
// ============================================

export interface OrganizationProvisionRequest {
  organizationName: string;
  notificationPhone: string;
  timezone: string;
}

export interface OrganizationProvisionResponse {
  success: boolean;
  message: string;
  organizationId: string;
  organization: Organization;
  subscription: Subscription;
  nextStep?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  business_hours_start: string | null;
  business_hours_end: string | null;
  notification_email: string | null;
  notification_phone: string | null;
  twilio_subaccount_sid: string | null;
  twilio_subaccount_auth_token: string | null;
  is_onboarding_complete: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Onboarding Types
// ============================================

export type OnboardingStep =
  | 'create_twilio_subaccount'
  | 'search_phone_numbers'
  | 'purchase_phone_number'
  | 'create_elevenlabs_agent'
  | 'finalize_subscription';

export interface OnboardingRequest {
  organizationId: string;
  subscriptionPlan: string;
  areaCode?: string;
}

export interface OnboardingStepResult {
  step: OnboardingStep;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface OnboardingResult {
  success: boolean;
  steps: OnboardingStepResult[];
  summary: {
    subaccountCreated: boolean;
    phoneProvisioned: boolean;
    agentCreated: boolean;
    subscriptionActive: boolean;
    phoneNumber: string | null;
  };
  error?: string;
}

// ============================================
// Subscription Types
// ============================================

export type SubscriptionPlan = 'core' | 'growth' | 'pro' | 'business' | 'enterprise';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  total_credits: number;
  used_credits: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// User & Profile Types
// ============================================

export type UserRole = 'owner' | 'admin' | 'staff';

export interface Profile {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Agent Types
// ============================================

export interface OrganizationAgent {
  id: string;
  organization_id: string;
  elevenlabs_agent_id: string | null;
  context: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface AgentContext {
  orgName: string;
  businessType: string;
  services?: string[];
  llmModel?: string;
  [key: string]: unknown;
}

export interface CreateAgentRequest {
  action: 'create-agent';
  organizationId: string;
  context?: string;
}

export interface UpdateAgentRequest {
  action: 'update-agent';
  organizationId: string;
  context: string;
  voiceId?: string;
}

export interface RenameAgentRequest {
  action: 'rename-agent';
  organizationId: string;
  name: string;
}

export type AgentActionRequest = CreateAgentRequest | UpdateAgentRequest | RenameAgentRequest;

export interface AgentActionResponse {
  success: boolean;
  agent_id?: string;
  error?: string;
  message?: string;
}

// ============================================
// Phone Number Types
// ============================================

export interface PhoneNumber {
  id: string;
  organization_id: string;
  twilio_sid: string | null;
  phone_number: string;
  friendly_name: string | null;
  is_active: boolean;
  is_after_hours_only: boolean;
  is_shared: boolean;
  provisioned_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Verification Types
// ============================================

export type VerificationType = 'email' | 'phone';

export interface VerificationCode {
  id: string;
  email: string | null;
  phone: string | null;
  code: string;
  type: VerificationType;
  expires_at: string;
  created_at: string;
}

export interface SendVerificationRequest {
  type: VerificationType;
  email?: string;
  phone?: string;
}

export interface SendVerificationResponse {
  success: boolean;
  error?: string;
  devMode?: boolean;
  code?: string; // Only in dev mode
}

export interface VerifyCodeRequest {
  type: VerificationType;
  code: string;
  email?: string;
  phone?: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Error Types
// ============================================

export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// ============================================
// Helper Type Guards
// ============================================

export function isCreateAgentRequest(req: AgentActionRequest): req is CreateAgentRequest {
  return req.action === 'create-agent';
}

export function isUpdateAgentRequest(req: AgentActionRequest): req is UpdateAgentRequest {
  return req.action === 'update-agent';
}

export function isRenameAgentRequest(req: AgentActionRequest): req is RenameAgentRequest {
  return req.action === 'rename-agent';
}
