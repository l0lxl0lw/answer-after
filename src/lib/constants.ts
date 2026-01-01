/**
 * Application-wide constants
 * Update these values in one place to reflect changes throughout the app
 */

export const COMPANY = {
  name: 'Answer After',
  nameCamelCase: 'AnswerAfter',
  website: 'answerafter.com',
} as const;

export const CONTACT = {
  sales: 'contact@answerafter.com',
  support: 'contact@answerafter.com',
  general: 'contact@answerafter.com',
} as const;

export const LINKS = {
  salesEmail: `mailto:${CONTACT.sales}`,
  supportEmail: `mailto:${CONTACT.support}`,
  generalEmail: `mailto:${CONTACT.general}`,
} as const;

export const APP_CONFIG = {
  trialDurationDays: 30,
  // Top-up packages
  topupPackages: {
    basic: { credits: 300, priceCents: 500, minutes: 5 },
    value: { credits: 1000, priceCents: 1500, minutes: 17 },
    bulk: { credits: 3000, priceCents: 4000, minutes: 50 },
  },
  // Overage rate
  overagePriceCentsPerMinute: 150, // $1.50/min
  // Legacy (for backwards compatibility)
  creditTopupAmount: 300,
  creditTopupPrice: 5,
} as const;

export type TopupPackageId = keyof typeof APP_CONFIG.topupPackages;

/**
 * Subscription plan identifiers
 */
export const SUBSCRIPTION_PLANS = {
  STARTER: 'starter',
  GROWTH: 'growth',
  PRO: 'pro',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlanId = typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS];

/**
 * Subscription status values
 */
export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  TRIALING: 'trialing',
  PENDING: 'pending',
} as const;

export type SubscriptionStatusValue = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES];

/**
 * Call status values
 */
export const CALL_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  VOICEMAIL: 'voicemail',
} as const;

export type CallStatusValue = typeof CALL_STATUSES[keyof typeof CALL_STATUSES];

/**
 * Call outcome values
 */
export const CALL_OUTCOMES = {
  BOOKED: 'booked',
  CALLBACK_REQUESTED: 'callback_requested',
  INFORMATION_PROVIDED: 'information_provided',
  ESCALATED: 'escalated',
  NO_ACTION: 'no_action',
  VOICEMAIL: 'voicemail',
} as const;

export type CallOutcomeValue = typeof CALL_OUTCOMES[keyof typeof CALL_OUTCOMES];

/**
 * Appointment status values
 */
export const APPOINTMENT_STATUSES = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export type AppointmentStatusValue = typeof APPOINTMENT_STATUSES[keyof typeof APPOINTMENT_STATUSES];

/**
 * User role values
 */
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
} as const;

export type UserRoleValue = typeof USER_ROLES[keyof typeof USER_ROLES];
