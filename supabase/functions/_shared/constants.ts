/**
 * Shared constants for edge functions
 * Centralizes hardcoded values for easier maintenance
 */

// ============= AI/LLM Configuration =============

/**
 * Default LLM model for AI operations
 */
export const DEFAULT_LLM_MODEL = 'gemini-2.5-flash';

/**
 * OpenRouter model format (includes provider prefix)
 */
export const OPENROUTER_LLM_MODEL = 'google/gemini-2.5-flash';

// ============= ElevenLabs Configuration =============

/**
 * Default voice ID (Veda Sky - professional female voice)
 */
export const DEFAULT_VOICE_ID = '625jGFaa0zTLtQfxwc6Q';

// ============= Business Configuration =============

/**
 * Default trial period in days
 */
export const TRIAL_DAYS = 30;

/**
 * Default callback hours offset for follow-up scheduling
 */
export const CALLBACK_HOURS_OFFSET = 2;

/**
 * Maximum retries for external API calls
 */
export const MAX_API_RETRIES = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
export const RETRY_BASE_DELAY_MS = 1000;

// ============= Phone Number Configuration =============

/**
 * US country code
 */
export const US_COUNTRY_CODE = '+1';

/**
 * Area code length (US)
 */
export const AREA_CODE_LENGTH = 3;
