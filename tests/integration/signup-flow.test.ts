import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestClient } from '../helpers/test-client';
import { generateTestUser, EXPECTED_CREDITS } from '../helpers/test-data';

describe('Signup Flow Integration Tests', () => {
  let testClient: TestClient;
  let testUser: ReturnType<typeof generateTestUser>;

  beforeEach(async () => {
    testClient = new TestClient();
    testUser = generateTestUser();
  });

  afterEach(async () => {
    // Cleanup test data
    if (testUser.email) {
      await testClient.cleanupTestData(testUser.email);
    }
  });

  describe('User Account Creation', () => {
    it('should create auth user with proper metadata', async () => {
      // Act: Create user
      const { data, error } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      // Assert
      expect(error).toBeNull();
      expect(data.user).toBeTruthy();
      expect(data.user?.email).toBe(testUser.email);
      expect(data.user?.user_metadata?.full_name).toBe(testUser.name);
      expect(data.user?.user_metadata?.organization_name).toBe(testUser.organizationName);

      testUser.id = data.user!.id;
    });

    it('should trigger handle_new_user and create profile', async () => {
      // Act: Create user
      const { data } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      testUser.id = data.user!.id;

      // Wait for trigger to execute
      const profileCreated = await testClient.waitForProfileCreation(testUser.id);
      expect(profileCreated).toBe(true);

      // Assert: Profile exists
      const { data: profile, error } = await testClient.supabase
        .from('profiles')
        .select('*')
        .eq('id', testUser.id)
        .single();

      expect(error).toBeNull();
      expect(profile).toBeTruthy();
      expect(profile?.email).toBe(testUser.email);
      expect(profile?.full_name).toBe(testUser.name);
      expect(profile?.organization_id).toBeNull(); // Not set until provisioning
    });
  });

  describe('Organization Provisioning', () => {
    it('should create organization, subscription, role, and agent record via provision-organization', async () => {
      // Arrange: Create user first
      const { data: authData } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      testUser.id = authData.user!.id;
      await testClient.waitForProfileCreation(testUser.id);

      // Act: Sign in to get session
      const { data: sessionData } = await testClient.supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      expect(sessionData.session).toBeTruthy();

      // Call provision-organization
      const { data: provisionData, error: provisionError } = await testClient.supabase.functions.invoke(
        'provision-organization',
        {
          headers: {
            Authorization: `Bearer ${sessionData.session!.access_token}`,
          },
          body: {
            organizationName: testUser.organizationName,
            notificationPhone: testUser.phone,
            timezone: 'America/New_York',
          },
        }
      );

      // Assert: Provisioning succeeded
      expect(provisionError).toBeNull();
      expect(provisionData?.success).toBe(true);
      expect(provisionData?.organizationId).toBeTruthy();

      const orgId = provisionData.organizationId;

      // Assert: Organization created
      const organization = await testClient.getOrganizationByEmail(testUser.email);
      expect(organization).toBeTruthy();
      expect(organization?.id).toBe(orgId);
      expect(organization?.name).toContain(testUser.organizationName);
      expect(organization?.notification_phone).toBe(testUser.phone);

      // Assert: Profile updated with organization_id
      const { data: profile } = await testClient.supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', testUser.id)
        .single();

      expect(profile?.organization_id).toBe(orgId);

      // Assert: User role created as owner
      const role = await testClient.getUserRoleByEmail(testUser.email);
      expect(role).toBe('owner');

      // Assert: Subscription created on core plan with trial status
      const subscription = await testClient.getSubscriptionByEmail(testUser.email);
      expect(subscription).toBeTruthy();
      expect(subscription?.plan).toBe('core');
      expect(subscription?.status).toBe('trial');
      expect(subscription?.total_credits).toBe(EXPECTED_CREDITS.core);
      expect(subscription?.used_credits).toBe(0);

      // Assert: Organization agent record created
      const agent = await testClient.getOrganizationAgent(orgId);
      expect(agent).toBeTruthy();
      expect(agent?.organization_id).toBe(orgId);
      expect(agent?.context).toBeTruthy();
    });

    it('should use exact organization name provided', async () => {
      // Arrange: Create and sign in user
      const { data: authData } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      testUser.id = authData.user!.id;
      await testClient.waitForProfileCreation(testUser.id);

      const { data: sessionData } = await testClient.supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      // Act: Provision organization
      await testClient.supabase.functions.invoke('provision-organization', {
        headers: {
          Authorization: `Bearer ${sessionData.session!.access_token}`,
        },
        body: {
          organizationName: testUser.organizationName,
          notificationPhone: testUser.phone,
          timezone: 'America/New_York',
        },
      });

      // Assert: Organization name matches exactly what was provided
      const organization = await testClient.getOrganizationByEmail(testUser.email);
      expect(organization?.name).toBe(testUser.organizationName);
    });

    it('should not allow duplicate organization creation for same user', async () => {
      // Arrange: Create user and provision organization
      const { data: authData } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      testUser.id = authData.user!.id;
      await testClient.waitForProfileCreation(testUser.id);

      const { data: sessionData } = await testClient.supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      // First provision - should succeed
      const { data: firstProvision } = await testClient.supabase.functions.invoke(
        'provision-organization',
        {
          headers: {
            Authorization: `Bearer ${sessionData.session!.access_token}`,
          },
          body: {
            organizationName: testUser.organizationName,
            notificationPhone: testUser.phone,
            timezone: 'America/New_York',
          },
        }
      );

      expect(firstProvision?.success).toBe(true);
      const firstOrgId = firstProvision.organizationId;

      // Act: Try to provision again
      const { data: secondProvision } = await testClient.supabase.functions.invoke(
        'provision-organization',
        {
          headers: {
            Authorization: `Bearer ${sessionData.session!.access_token}`,
          },
          body: {
            organizationName: 'Different Organization',
            notificationPhone: testUser.phone,
            timezone: 'America/New_York',
          },
        }
      );

      // Assert: Should return existing organization
      expect(secondProvision?.success).toBe(true);
      expect(secondProvision?.message).toContain('already exists');
      expect(secondProvision?.organizationId).toBe(firstOrgId);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity across all tables', async () => {
      // Arrange & Act: Complete signup and provisioning
      const { data: authData } = await testClient.supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
            organization_name: testUser.organizationName,
          },
        },
      });

      testUser.id = authData.user!.id;
      await testClient.waitForProfileCreation(testUser.id);

      const { data: sessionData } = await testClient.supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      const { data: provisionData } = await testClient.supabase.functions.invoke(
        'provision-organization',
        {
          headers: {
            Authorization: `Bearer ${sessionData.session!.access_token}`,
          },
          body: {
            organizationName: testUser.organizationName,
            notificationPhone: testUser.phone,
            timezone: 'America/New_York',
          },
        }
      );

      const orgId = provisionData.organizationId;

      // Assert: All foreign key relationships are valid
      const { data: profile } = await testClient.supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', testUser.id)
        .single();

      const { data: userRole } = await testClient.supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', testUser.id)
        .single();

      const { data: subscription } = await testClient.supabase
        .from('subscriptions')
        .select('organization_id')
        .eq('organization_id', orgId)
        .single();

      const { data: agent } = await testClient.supabase
        .from('account_agents')
        .select('account_id')
        .eq('account_id', orgId)
        .single();

      // All relationships should be valid
      expect(profile?.organization_id).toBe(orgId);
      expect(userRole?.user_id).toBe(testUser.id);
      expect(subscription?.organization_id).toBe(orgId);
      expect(agent?.account_id).toBe(orgId);
    });
  });
});
