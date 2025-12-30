import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../helpers/test-client';
import { generateTestUser, TEST_PLANS, EXPECTED_CREDITS, EXPECTED_FEATURES } from '../helpers/test-data';

/**
 * Onboarding Flow Integration Tests
 *
 * Tests the complete onboarding flow for each subscription plan:
 * - Core: Shows UpgradePrompt, auto-creates agent
 * - Growth: Shows UpgradePrompt, allows custom greeting/services
 * - Pro: Skips UpgradePrompt (hasCustomAiTraining=true), full customization
 * - Business: Skips UpgradePrompt, all features including voice selection
 *
 * Also tests UpgradePrompt branching logic:
 * - Continue: Proceeds to setup-services with current plan
 * - Upgrade: Would redirect to subscriptions page
 */

describe('Onboarding Flow Integration Tests', () => {
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

  describe('Core Plan Onboarding', () => {
    const plan = TEST_PLANS.CORE;

    it('provisions organization with core plan and correct credits', async () => {
      // Act: Create user with core plan
      const { organizationId } = await testClient.createUserWithPlan(testUser, plan);

      // Assert: Subscription created with correct plan
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(plan);
      expect(subscription?.status).toBe('trial');
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.core);
      expect(subscription?.used_credits).toBe(0);

      // Assert: Organization agent record created
      const agent = await testClient.getOrganizationAgent(organizationId);
      expect(agent).toBeTruthy();
      expect(agent?.organization_id).toBe(organizationId);
    });

    it('has correct feature flags (hasCustomAiTraining=false, shows UpgradePrompt)', async () => {
      // Act: Get tier feature flags
      const tier = await testClient.getSubscriptionTier(plan);

      // Assert: Feature flags match expected
      expect(tier).toBeTruthy();
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.core.has_custom_agent);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.core.has_custom_ai_training);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.core.has_voice_selection);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.core.has_outbound_reminders);

      // Key assertion: Core plan does NOT have custom AI training
      // This means UpgradePrompt page should be shown during onboarding
      expect(tier?.has_custom_ai_training).toBe(false);
    });

    it('has has_custom_agent=false (auto-creates default agent)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Core plan: has_custom_agent=false
      // This means SetupServices will auto-create a default agent
      // instead of showing customization UI
      expect(tier?.has_custom_agent).toBe(false);
    });

    it('UpgradePrompt Continue branch: maintains core plan', async () => {
      // Arrange: Create user with core plan
      await testClient.createUserWithPlan(testUser, plan);

      // Simulate "Continue with Core" action (no plan change)
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);

      // Assert: Plan remains core after "Continue" action
      expect(subscription?.plan).toBe(plan);
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.core);
    });

    it('UpgradePrompt Upgrade branch: can upgrade to growth plan', async () => {
      // Arrange: Create user with core plan
      await testClient.createUserWithPlan(testUser, plan);

      // Act: Simulate upgrade to growth
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.GROWTH);

      // Assert: Plan upgraded to growth with new credits
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.GROWTH);
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.growth);
    });
  });

  describe('Growth Plan Onboarding', () => {
    const plan = TEST_PLANS.GROWTH;

    it('provisions organization with growth plan and correct credits', async () => {
      // Act: Create user with growth plan
      const { organizationId } = await testClient.createUserWithPlan(testUser, plan);

      // Assert: Subscription created with correct plan
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(plan);
      expect(subscription?.status).toBe('trial');
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.growth);

      // Assert: Organization agent created
      const agent = await testClient.getOrganizationAgent(organizationId);
      expect(agent).toBeTruthy();
    });

    it('has correct feature flags (hasCustomAiTraining=false, shows UpgradePrompt)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      expect(tier).toBeTruthy();
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.growth.has_custom_agent);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.growth.has_custom_ai_training);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.growth.has_voice_selection);
      expect(tier?.has_priority_support).toBe(EXPECTED_FEATURES.growth.has_priority_support);

      // Key assertion: Growth plan does NOT have custom AI training
      // UpgradePrompt page should still be shown
      expect(tier?.has_custom_ai_training).toBe(false);
    });

    it('has has_custom_agent=true (allows custom greeting and services)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Growth plan: has_custom_agent=true
      // This enables greeting customization and service configuration
      expect(tier?.has_custom_agent).toBe(true);
    });

    it('does NOT have custom AI training (Pro+ feature)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Growth plan cannot customize AI instructions/context
      expect(tier?.has_custom_ai_training).toBe(false);
    });

    it('UpgradePrompt Upgrade branch: can upgrade to pro plan', async () => {
      // Arrange: Create user with growth plan
      await testClient.createUserWithPlan(testUser, plan);

      // Act: Simulate upgrade to pro
      await testClient.updateSubscriptionPlan(testUser.email, TEST_PLANS.PRO);

      // Assert: Plan upgraded to pro with new credits
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription?.plan).toBe(TEST_PLANS.PRO);
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.pro);
    });
  });

  describe('Pro Plan Onboarding', () => {
    const plan = TEST_PLANS.PRO;

    it('provisions organization with pro plan and correct credits', async () => {
      // Act: Create user with pro plan
      const { organizationId } = await testClient.createUserWithPlan(testUser, plan);

      // Assert: Subscription created with correct plan
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(plan);
      expect(subscription?.status).toBe('trial');
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.pro);

      // Assert: Organization agent created
      const agent = await testClient.getOrganizationAgent(organizationId);
      expect(agent).toBeTruthy();
    });

    it('has correct feature flags (hasCustomAiTraining=true, SKIPS UpgradePrompt)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      expect(tier).toBeTruthy();
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.pro.has_custom_agent);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.pro.has_custom_ai_training);
      expect(tier?.has_outbound_reminders).toBe(EXPECTED_FEATURES.pro.has_outbound_reminders);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.pro.has_voice_selection);

      // Key assertion: Pro plan HAS custom AI training
      // UpgradePrompt page should be SKIPPED during onboarding
      expect(tier?.has_custom_ai_training).toBe(true);
    });

    it('has full customization access (greeting, services, instructions)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Pro plan has all customization features except voice selection
      expect(tier?.has_custom_agent).toBe(true);
      expect(tier?.has_custom_ai_training).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(true);
    });

    it('does NOT have voice selection (Business+ feature)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Pro plan cannot select custom voice
      expect(tier?.has_voice_selection).toBe(false);
    });
  });

  describe('Business Plan Onboarding', () => {
    const plan = TEST_PLANS.BUSINESS;

    it('provisions organization with business plan and correct credits', async () => {
      // Act: Create user with business plan
      const { organizationId } = await testClient.createUserWithPlan(testUser, plan);

      // Assert: Subscription created with correct plan
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe(plan);
      expect(subscription?.status).toBe('trial');
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.business);

      // Assert: Organization agent created
      const agent = await testClient.getOrganizationAgent(organizationId);
      expect(agent).toBeTruthy();
    });

    it('has correct feature flags (hasCustomAiTraining=true, SKIPS UpgradePrompt)', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      expect(tier).toBeTruthy();
      expect(tier?.has_custom_agent).toBe(EXPECTED_FEATURES.business.has_custom_agent);
      expect(tier?.has_custom_ai_training).toBe(EXPECTED_FEATURES.business.has_custom_ai_training);
      expect(tier?.has_voice_selection).toBe(EXPECTED_FEATURES.business.has_voice_selection);
      expect(tier?.has_api_access).toBe(EXPECTED_FEATURES.business.has_api_access);

      // Key assertion: Business plan HAS custom AI training
      // UpgradePrompt page should be SKIPPED during onboarding
      expect(tier?.has_custom_ai_training).toBe(true);
    });

    it('has ALL features including voice selection and API access', async () => {
      const tier = await testClient.getSubscriptionTier(plan);

      // Business plan has all features
      expect(tier?.has_custom_agent).toBe(true);
      expect(tier?.has_custom_ai_training).toBe(true);
      expect(tier?.has_outbound_reminders).toBe(true);
      expect(tier?.has_voice_selection).toBe(true);
      expect(tier?.has_api_access).toBe(true);
      expect(tier?.has_multi_language).toBe(true);
    });
  });

  describe('UpgradePrompt Branching Logic', () => {
    it('Core and Growth plans show UpgradePrompt (hasCustomAiTraining=false)', async () => {
      const coreTier = await testClient.getSubscriptionTier(TEST_PLANS.CORE);
      const growthTier = await testClient.getSubscriptionTier(TEST_PLANS.GROWTH);

      // Both Core and Growth should show UpgradePrompt
      expect(coreTier?.has_custom_ai_training).toBe(false);
      expect(growthTier?.has_custom_ai_training).toBe(false);
    });

    it('Pro and Business plans skip UpgradePrompt (hasCustomAiTraining=true)', async () => {
      const proTier = await testClient.getSubscriptionTier(TEST_PLANS.PRO);
      const businessTier = await testClient.getSubscriptionTier(TEST_PLANS.BUSINESS);

      // Both Pro and Business should skip UpgradePrompt
      expect(proTier?.has_custom_ai_training).toBe(true);
      expect(businessTier?.has_custom_ai_training).toBe(true);
    });

    it('upgrade hierarchy follows core → growth → pro → business', async () => {
      const PLAN_HIERARCHY = ['core', 'growth', 'pro', 'business'];

      // Verify each plan's position in hierarchy
      expect(PLAN_HIERARCHY.indexOf(TEST_PLANS.CORE)).toBe(0);
      expect(PLAN_HIERARCHY.indexOf(TEST_PLANS.GROWTH)).toBe(1);
      expect(PLAN_HIERARCHY.indexOf(TEST_PLANS.PRO)).toBe(2);
      expect(PLAN_HIERARCHY.indexOf(TEST_PLANS.BUSINESS)).toBe(3);
    });

    it('upgrade from core targets growth plan', async () => {
      const PLAN_HIERARCHY = ['core', 'growth', 'pro', 'business'];
      const currentIndex = PLAN_HIERARCHY.indexOf(TEST_PLANS.CORE);
      const upgradePlan = PLAN_HIERARCHY[currentIndex + 1];

      expect(upgradePlan).toBe(TEST_PLANS.GROWTH);
    });

    it('upgrade from growth targets pro plan', async () => {
      const PLAN_HIERARCHY = ['core', 'growth', 'pro', 'business'];
      const currentIndex = PLAN_HIERARCHY.indexOf(TEST_PLANS.GROWTH);
      const upgradePlan = PLAN_HIERARCHY[currentIndex + 1];

      expect(upgradePlan).toBe(TEST_PLANS.PRO);
    });
  });

  describe('Plan Credits Verification', () => {
    it('all plans have correct credit allocations', async () => {
      const tiers = await testClient.getAllSubscriptionTiers();

      // Find each tier and verify credits
      const coreTier = tiers.find(t => t.plan_id === TEST_PLANS.CORE);
      const growthTier = tiers.find(t => t.plan_id === TEST_PLANS.GROWTH);
      const proTier = tiers.find(t => t.plan_id === TEST_PLANS.PRO);
      const businessTier = tiers.find(t => t.plan_id === TEST_PLANS.BUSINESS);

      expect(coreTier?.credits).toBe(EXPECTED_CREDITS.core);
      expect(growthTier?.credits).toBe(EXPECTED_CREDITS.growth);
      expect(proTier?.credits).toBe(EXPECTED_CREDITS.pro);
      expect(businessTier?.credits).toBe(EXPECTED_CREDITS.business);
    });

    it('credits increase with each tier level', async () => {
      const tiers = await testClient.getAllSubscriptionTiers();

      const coreTier = tiers.find(t => t.plan_id === TEST_PLANS.CORE);
      const growthTier = tiers.find(t => t.plan_id === TEST_PLANS.GROWTH);
      const proTier = tiers.find(t => t.plan_id === TEST_PLANS.PRO);
      const businessTier = tiers.find(t => t.plan_id === TEST_PLANS.BUSINESS);

      expect(growthTier!.credits).toBeGreaterThan(coreTier!.credits);
      expect(proTier!.credits).toBeGreaterThan(growthTier!.credits);
      expect(businessTier!.credits).toBeGreaterThan(proTier!.credits);
    });
  });
});
