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
  creditTopupAmount: 300,
  creditTopupPrice: 10,
} as const;
