import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../helpers/test-client';
import { generateTestUser, TEST_PLANS, EXPECTED_FEATURES } from '../helpers/test-data';

/**
 * Feature Access Control Integration Tests
 *
 * Tests that each subscription plan has the correct feature access:
 * - MyAgent page access (has_custom_agent)
 * - Custom instructions (has_custom_ai_training)
 * - Voice selection (has_voice_selection)
 * - Calendar access (not subscription-gated)
 * - API access (has_api_access)
 * - Outbound reminders (has_outbound_reminders)
 *
 * These tests verify the database feature flags that control
 * what UI elements are shown/hidden in the application.
 */

describe('Feature Access Control Integration Tests', () => {
  let testClient: TestClient;
  let testUser: ReturnType<typeof generateTestUser>;

  beforeEach(async () => {
    testClient = new TestClient();
    testUser = generateTestUser();
  });

  afterEach(async () => {
    if (testUser.email) {
      await testClient.cleanupTestData(testUser.email);
    }
  });

  describe('MyAgent Page Access (has_custom_agent)', () => {
    it('Core plan: has_custom_agent=false (shows upgrade prompt instead of customization)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.CORE);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);

      // Core plan should NOT have custom agent access
      // UI should show upgrade card instead of customization options
      expect(tier?.has_custom_agent).toBe(false);
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.core.has_custom_agent);
    });

    it('Growth plan: has_custom_agent=true (can customize greeting and services)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.GROWTH);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      // Growth plan should have custom agent access
      // UI should show greeting and services customization
      expect(tier?.has_custom_agent).toBe(true);
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.growth.has_custom_agent);
    });

    it('Pro plan: has_custom_agent=true + has_outbound_reminders=true (full agent customization)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.PRO);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);

      // Pro plan has custom agent and context/instructions editing
      expect(tier?.has_custom_agent).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(true);
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.pro.has_custom_agent);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.pro.has_outbound_reminders);
    });

    it('Business plan: has_voice_selection=true (voice customization available)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.BUSINESS);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Business plan has all agent features including voice selection
      expect(tier?.has_custom_agent).toBe(true);
      expect(tier?.has_voice_selection).toBe(true);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.business.has_voice_selection);
    });
  });

  describe('Custom Instructions Access (has_custom_ai_training)', () => {
    it('Core plan: has_custom_ai_training=false (no custom instructions access)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.CORE);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);

      // Core plan cannot customize AI instructions
      expect(tier?.has_custom_ai_training).toBe(false);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.core.has_custom_ai_training);
    });

    it('Growth plan: has_custom_ai_training=false (no custom instructions access)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.GROWTH);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      // Growth plan cannot customize AI instructions
      expect(tier?.has_custom_ai_training).toBe(false);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.growth.has_custom_ai_training);
    });

    it('Pro plan: has_custom_ai_training=true (can add custom instructions)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.PRO);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);

      // Pro plan CAN customize AI instructions
      expect(tier?.has_custom_ai_training).toBe(true);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.pro.has_custom_ai_training);
    });

    it('Business plan: has_custom_ai_training=true (can add custom instructions)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.BUSINESS);

      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Business plan CAN customize AI instructions
      expect(tier?.has_custom_ai_training).toBe(true);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.business.has_custom_ai_training);
    });
  });

  describe('Voice Selection Access (has_voice_selection)', () => {
    it('Core plan: has_voice_selection=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);

      expect(tier?.has_voice_selection).toBe(false);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.core.has_voice_selection);
    });

    it('Growth plan: has_voice_selection=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      expect(tier?.has_voice_selection).toBe(false);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.growth.has_voice_selection);
    });

    it('Pro plan: has_voice_selection=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);

      expect(tier?.has_voice_selection).toBe(false);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.pro.has_voice_selection);
    });

    it('Business plan: has_voice_selection=true (can select agent voice)', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Only Business plan can select custom voice
      expect(tier?.has_voice_selection).toBe(true);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.business.has_voice_selection);
    });
  });

  describe('Calendar Access (not subscription-gated)', () => {
    it('Core plan can access calendar (requires Google connection, not subscription)', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.CORE);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);

      // Calendar access is not restricted by subscription
      // Only requires Google OAuth connection
      // Verify user has a valid subscription (any plan can access)
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(TEST_PLANS.CORE);
    });

    it('Growth plan can access calendar', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.GROWTH);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(TEST_PLANS.GROWTH);
    });

    it('Pro plan can access calendar', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.PRO);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(TEST_PLANS.PRO);
    });

    it('Business plan can access calendar', async () => {
      await testClient.createUserWithPlan(testUser, TEST_PLANS.BUSINESS);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(TEST_PLANS.BUSINESS);
    });
  });

  describe('API Access (has_api_access)', () => {
    it('Core plan: has_api_access=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);

      expect(tier?.has_api_access).toBe(false);
      expect(tier?.has_api_access).toBe(EXPECTED_FEATURES.core.has_api_access);
    });

    it('Growth plan: has_api_access=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      expect(tier?.has_api_access).toBe(false);
      expect(tier?.has_api_access).toBe(EXPECTED_FEATURES.growth.has_api_access);
    });

    it('Pro plan: has_api_access=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);

      expect(tier?.has_api_access).toBe(false);
      expect(tier?.has_api_access).toBe(EXPECTED_FEATURES.pro.has_api_access);
    });

    it('Business plan: has_api_access=true (can access API)', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Only Business plan has API access
      expect(tier?.has_api_access).toBe(true);
      expect(tier?.has_api_access).toBe(EXPECTED_FEATURES.business.has_api_access);
    });
  });

  describe('Outbound Reminders Access (has_outbound_reminders)', () => {
    it('Core plan: has_outbound_reminders=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);

      expect(tier?.has_outbound_reminders).toBe(false);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.core.has_outbound_reminders);
    });

    it('Growth plan: has_outbound_reminders=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      expect(tier?.has_outbound_reminders).toBe(false);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.growth.has_outbound_reminders);
    });

    it('Pro plan: has_outbound_reminders=true (can send outbound reminder calls)', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);

      // Pro plan has outbound reminders
      expect(tier?.has_outbound_reminders).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.pro.has_outbound_reminders);
    });

    it('Business plan: has_outbound_reminders=true', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      expect(tier?.has_outbound_reminders).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.business.has_outbound_reminders);
    });
  });

  describe('Call Recordings Access (has_call_recordings)', () => {
    it('all plans have call recordings access', async () => {
      const coreTier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);
      const growthTier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);
      const proTier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);
      const businessTier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Call recordings is available on all plans
      expect(coreTier?.has_call_recordings).toBe(true);
      expect(growthTier?.has_call_recordings).toBe(true);
      expect(proTier?.has_call_recordings).toBe(true);
      expect(businessTier?.has_call_recordings).toBe(true);
    });
  });

  describe('Priority Support Access (has_priority_support)', () => {
    it('Core plan: has_priority_support=false', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);
      expect(tier?.has_priority_support).toBe(false);
    });

    it('Growth plan: has_priority_support=true', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);
      expect(tier?.has_priority_support).toBe(true);
    });

    it('Pro plan: has_priority_support=true', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);
      expect(tier?.has_priority_support).toBe(true);
    });

    it('Business plan: has_priority_support=true', async () => {
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);
      expect(tier?.has_priority_support).toBe(true);
    });
  });

  describe('Feature Access After Plan Change', () => {
    it('upgrading from Core to Growth unlocks custom agent', async () => {
      // Start with Core plan
      await testClient.createUserWithPlan(testUser, TEST_PLANS.CORE);

      let subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.CORE);

      // Upgrade to Growth
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.GROWTH);

      subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.GROWTH);

      // Verify new features are accessible
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);
      expect(tier?.has_custom_agent).toBe(true);
    });

    it('upgrading from Growth to Pro unlocks custom AI training', async () => {
      // Start with Growth plan
      await testClient.createUserWithPlan(testUser, TEST_PLANS.GROWTH);

      // Upgrade to Pro
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.PRO);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.PRO);

      // Verify new features are accessible
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);
      expect(tier?.has_custom_ai_training).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(true);
    });

    it('upgrading from Pro to Business unlocks voice selection and API', async () => {
      // Start with Pro plan
      await testClient.createUserWithPlan(testUser, TEST_PLANS.PRO);

      // Upgrade to Business
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.BUSINESS);

      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.BUSINESS);

      // Verify new features are accessible
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);
      expect(tier?.has_voice_selection).toBe(true);
      expect(tier?.has_api_access).toBe(true);
      expect(tier?.has_multi_language).toBe(true);
    });

    it('downgrading from Business to Core removes premium features', async () => {
      // Start with Business plan
      await testClient.createUserWithPlan(testUser, TEST_PLANS.BUSINESS);

      let subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.BUSINESS);

      // Downgrade to Core
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.CORE);

      subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.CORE);

      // Verify features are now restricted based on Core tier
      const tier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);
      expect(tier?.has_custom_agent).toBe(false);
      expect(tier?.has_custom_ai_training).toBe(false);
      expect(tier?.has_voice_selection).toBe(false);
      expect(tier?.has_api_access).toBe(false);
    });
  });

  describe('Complete Feature Matrix Verification', () => {
    it('verifies all feature flags match expected values for all plans', async () => {
      const plans = [TEST_PLANS.CORE, TEST_PLANS.GROWTH, TEST_PLANS.PRO, TEST_PLANS.BUSINESS] as const;

      for (const plan of plans) {
        const tier = await testClient.getSubscriptionTier(plan);
        const expected = EXPECTED_FEATURES[plan];

        expect(tier?.has_custom_agent).toBe(expected.has_custom_agent);
        expect(tier?.has_custom_ai_training).toBe(expected.has_custom_ai_training);
        expect(tier?.has_voice_selection).toBe(expected.has_voice_selection);
        expect(tier?.has_outbound_reminders).toBe(expected.has_outbound_reminders);
        expect(tier?.has_call_recordings).toBe(expected.has_call_recordings);
        expect(tier?.has_api_access).toBe(expected.has_api_access);
        expect(tier?.has_priority_support).toBe(expected.has_priority_support);
      }
    });
  });
});
