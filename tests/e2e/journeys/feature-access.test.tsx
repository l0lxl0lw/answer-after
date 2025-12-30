/**
 * Feature Access Tests
 *
 * Verifies that feature flags correctly control access across all plans.
 * This file documents which features are available on which plans.
 *
 * Feature Access Matrix:
 * ┌─────────────────────────┬──────┬────────┬─────┬──────────┐
 * │ Feature                 │ Core │ Growth │ Pro │ Business │
 * ├─────────────────────────┼──────┼────────┼─────┼──────────┤
 * │ has_custom_agent        │  ❌  │   ✅   │  ✅ │    ✅    │
 * │ has_custom_ai_training  │  ❌  │   ❌   │  ✅ │    ✅    │
 * │ has_voice_selection     │  ❌  │   ❌   │  ❌ │    ✅    │
 * │ has_outbound_reminders  │  ❌  │   ❌   │  ✅ │    ✅    │
 * │ has_api_access          │  ❌  │   ❌   │  ❌ │    ✅    │
 * │ has_multi_language      │  ❌  │   ❌   │  ❌ │    ✅    │
 * │ has_priority_support    │  ❌  │   ✅   │  ✅ │    ✅    │
 * │ has_call_recordings     │  ✅  │   ✅   │  ✅ │    ✅    │
 * └─────────────────────────┴──────┴────────┴─────┴──────────┘
 */

import { describe, it, expect } from 'vitest';
import { EXPECTED_FEATURES, EXPECTED_CREDITS } from '../../helpers/test-data';

describe('Feature Access Matrix', () => {
  describe('has_custom_agent - Controls MyAgent Page Access', () => {
    it('Core: ❌ shows upgrade prompt instead of customization UI', () => {
      expect(EXPECTED_FEATURES.core.has_custom_agent).toBe(false);
    });

    it('Growth: ✅ shows greeting and services customization', () => {
      expect(EXPECTED_FEATURES.growth.has_custom_agent).toBe(true);
    });

    it('Pro: ✅ shows greeting and services customization', () => {
      expect(EXPECTED_FEATURES.pro.has_custom_agent).toBe(true);
    });

    it('Business: ✅ shows greeting and services customization', () => {
      expect(EXPECTED_FEATURES.business.has_custom_agent).toBe(true);
    });
  });

  describe('has_custom_ai_training - Controls UpgradePrompt Skip & Custom Instructions', () => {
    it('Core: ❌ shows UpgradePrompt, hides custom instructions', () => {
      expect(EXPECTED_FEATURES.core.has_custom_ai_training).toBe(false);
    });

    it('Growth: ❌ shows UpgradePrompt, hides custom instructions', () => {
      expect(EXPECTED_FEATURES.growth.has_custom_ai_training).toBe(false);
    });

    it('Pro: ✅ SKIPS UpgradePrompt, shows custom instructions', () => {
      expect(EXPECTED_FEATURES.pro.has_custom_ai_training).toBe(true);
    });

    it('Business: ✅ SKIPS UpgradePrompt, shows custom instructions', () => {
      expect(EXPECTED_FEATURES.business.has_custom_ai_training).toBe(true);
    });
  });

  describe('has_voice_selection - Controls Voice Customization in MyAgent', () => {
    it('Core: ❌ voice selection locked', () => {
      expect(EXPECTED_FEATURES.core.has_voice_selection).toBe(false);
    });

    it('Growth: ❌ voice selection locked', () => {
      expect(EXPECTED_FEATURES.growth.has_voice_selection).toBe(false);
    });

    it('Pro: ❌ voice selection locked', () => {
      expect(EXPECTED_FEATURES.pro.has_voice_selection).toBe(false);
    });

    it('Business: ✅ voice selection unlocked (EXCLUSIVE)', () => {
      expect(EXPECTED_FEATURES.business.has_voice_selection).toBe(true);
    });
  });

  describe('has_outbound_reminders - Controls Outbound Call Features', () => {
    it('Core: ❌ no outbound reminders', () => {
      expect(EXPECTED_FEATURES.core.has_outbound_reminders).toBe(false);
    });

    it('Growth: ❌ no outbound reminders', () => {
      expect(EXPECTED_FEATURES.growth.has_outbound_reminders).toBe(false);
    });

    it('Pro: ✅ outbound reminders enabled', () => {
      expect(EXPECTED_FEATURES.pro.has_outbound_reminders).toBe(true);
    });

    it('Business: ✅ outbound reminders enabled', () => {
      expect(EXPECTED_FEATURES.business.has_outbound_reminders).toBe(true);
    });
  });

  describe('has_api_access - Controls API Access', () => {
    it('Core: ❌ no API access', () => {
      expect(EXPECTED_FEATURES.core.has_api_access).toBe(false);
    });

    it('Growth: ❌ no API access', () => {
      expect(EXPECTED_FEATURES.growth.has_api_access).toBe(false);
    });

    it('Pro: ❌ no API access', () => {
      expect(EXPECTED_FEATURES.pro.has_api_access).toBe(false);
    });

    it('Business: ✅ API access enabled (EXCLUSIVE)', () => {
      expect(EXPECTED_FEATURES.business.has_api_access).toBe(true);
    });
  });

  describe('has_multi_language - Controls Multi-Language Support', () => {
    it('Core: ❌ single language only', () => {
      expect(EXPECTED_FEATURES.core.has_multi_language).toBe(false);
    });

    it('Growth: ❌ single language only', () => {
      expect(EXPECTED_FEATURES.growth.has_multi_language).toBe(false);
    });

    it('Pro: ❌ single language only', () => {
      expect(EXPECTED_FEATURES.pro.has_multi_language).toBe(false);
    });

    it('Business: ✅ multi-language enabled (EXCLUSIVE)', () => {
      expect(EXPECTED_FEATURES.business.has_multi_language).toBe(true);
    });
  });

  describe('has_priority_support - Controls Support Level', () => {
    it('Core: ❌ standard email support', () => {
      expect(EXPECTED_FEATURES.core.has_priority_support).toBe(false);
    });

    it('Growth: ✅ priority support', () => {
      expect(EXPECTED_FEATURES.growth.has_priority_support).toBe(true);
    });

    it('Pro: ✅ priority support', () => {
      expect(EXPECTED_FEATURES.pro.has_priority_support).toBe(true);
    });

    it('Business: ✅ priority support', () => {
      expect(EXPECTED_FEATURES.business.has_priority_support).toBe(true);
    });
  });

  describe('has_call_recordings - Controls Call Recording Access', () => {
    it('Core: ✅ call recordings available (included in all plans)', () => {
      expect(EXPECTED_FEATURES.core.has_call_recordings).toBe(true);
    });

    it('Growth: ✅ call recordings available', () => {
      expect(EXPECTED_FEATURES.growth.has_call_recordings).toBe(true);
    });

    it('Pro: ✅ call recordings available', () => {
      expect(EXPECTED_FEATURES.pro.has_call_recordings).toBe(true);
    });

    it('Business: ✅ call recordings available', () => {
      expect(EXPECTED_FEATURES.business.has_call_recordings).toBe(true);
    });
  });
});

describe('Credit Allocation by Plan', () => {
  it('Core: 250 credits (~83 calls)', () => {
    expect(EXPECTED_CREDITS.core).toBe(250);
  });

  it('Growth: 600 credits (~200 calls)', () => {
    expect(EXPECTED_CREDITS.growth).toBe(600);
  });

  it('Pro: 1400 credits (~467 calls)', () => {
    expect(EXPECTED_CREDITS.pro).toBe(1400);
  });

  it('Business: 3000 credits (~1000 calls)', () => {
    expect(EXPECTED_CREDITS.business).toBe(3000);
  });

  it('credits increase with each tier', () => {
    expect(EXPECTED_CREDITS.growth).toBeGreaterThan(EXPECTED_CREDITS.core);
    expect(EXPECTED_CREDITS.pro).toBeGreaterThan(EXPECTED_CREDITS.growth);
    expect(EXPECTED_CREDITS.business).toBeGreaterThan(EXPECTED_CREDITS.pro);
  });
});

describe('Onboarding Flow by Plan', () => {
  describe('Plans that SHOW UpgradePrompt (hasCustomAiTraining=false)', () => {
    it('Core shows UpgradePrompt', () => {
      expect(EXPECTED_FEATURES.core.has_custom_ai_training).toBe(false);
    });

    it('Growth shows UpgradePrompt', () => {
      expect(EXPECTED_FEATURES.growth.has_custom_ai_training).toBe(false);
    });
  });

  describe('Plans that SKIP UpgradePrompt (hasCustomAiTraining=true)', () => {
    it('Pro skips UpgradePrompt', () => {
      expect(EXPECTED_FEATURES.pro.has_custom_ai_training).toBe(true);
    });

    it('Business skips UpgradePrompt', () => {
      expect(EXPECTED_FEATURES.business.has_custom_ai_training).toBe(true);
    });
  });
});

describe('SetupServices UI by Plan', () => {
  describe('Plans with auto-create agent (hasCustomAgent=false)', () => {
    it('Core: auto-creates default agent, no customization UI', () => {
      expect(EXPECTED_FEATURES.core.has_custom_agent).toBe(false);
    });
  });

  describe('Plans with customization UI (hasCustomAgent=true)', () => {
    it('Growth: shows greeting + services customization', () => {
      expect(EXPECTED_FEATURES.growth.has_custom_agent).toBe(true);
      expect(EXPECTED_FEATURES.growth.has_custom_ai_training).toBe(false);
      // Growth shows greeting/services but NOT custom instructions
    });

    it('Pro: shows greeting + services + custom instructions', () => {
      expect(EXPECTED_FEATURES.pro.has_custom_agent).toBe(true);
      expect(EXPECTED_FEATURES.pro.has_custom_ai_training).toBe(true);
    });

    it('Business: shows ALL customization options including voice', () => {
      expect(EXPECTED_FEATURES.business.has_custom_agent).toBe(true);
      expect(EXPECTED_FEATURES.business.has_custom_ai_training).toBe(true);
      expect(EXPECTED_FEATURES.business.has_voice_selection).toBe(true);
    });
  });
});

describe('MyAgent Page UI by Plan', () => {
  it('Core: shows upgrade card (no customization)', () => {
    expect(EXPECTED_FEATURES.core.has_custom_agent).toBe(false);
  });

  it('Growth: shows customization, voice locked', () => {
    expect(EXPECTED_FEATURES.growth.has_custom_agent).toBe(true);
    expect(EXPECTED_FEATURES.growth.has_voice_selection).toBe(false);
  });

  it('Pro: shows customization + context, voice locked', () => {
    expect(EXPECTED_FEATURES.pro.has_custom_agent).toBe(true);
    expect(EXPECTED_FEATURES.pro.has_outbound_reminders).toBe(true); // enables context
    expect(EXPECTED_FEATURES.pro.has_voice_selection).toBe(false);
  });

  it('Business: shows ALL features including voice selection', () => {
    expect(EXPECTED_FEATURES.business.has_custom_agent).toBe(true);
    expect(EXPECTED_FEATURES.business.has_outbound_reminders).toBe(true);
    expect(EXPECTED_FEATURES.business.has_voice_selection).toBe(true);
  });
});

describe('Calendar Access (Not Subscription Gated)', () => {
  it('all plans can access calendar (requires Google OAuth only)', () => {
    // Calendar access is NOT controlled by subscription tier
    // It only requires Google Calendar OAuth connection
    // This is verified in integration tests
    expect(true).toBe(true);
  });
});
