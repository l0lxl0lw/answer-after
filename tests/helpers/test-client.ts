import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  organizationName: string;
  phone: string;
}

export class TestClient {
  public supabase: SupabaseClient;
  private serviceRoleClient: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    if (!supabaseAnonKey) {
      throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required');
    }

    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);
  }

  async cleanupTestData(email: string) {
    console.log(`[TestClient] Cleaning up test data for: ${email}`);

    // Get user ID
    const { data: profile } = await this.serviceRoleClient
      .from('profiles')
      .select('id, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      console.log('[TestClient] No profile found, nothing to clean');
      return;
    }

    const userId = profile.id;
    const orgId = profile.organization_id;

    // Delete in reverse order of creation (respecting foreign keys)
    if (orgId) {
      // Delete organization-related data
      await this.serviceRoleClient.from('organization_agents').delete().eq('organization_id', orgId);
      await this.serviceRoleClient.from('phone_numbers').delete().eq('organization_id', orgId);
      await this.serviceRoleClient.from('subscriptions').delete().eq('organization_id', orgId);
      await this.serviceRoleClient.from('purchased_credits').delete().eq('organization_id', orgId);

      // Delete user roles
      await this.serviceRoleClient.from('user_roles').delete().eq('user_id', userId);

      // Update profile to remove org reference
      await this.serviceRoleClient.from('profiles').update({ organization_id: null }).eq('id', userId);

      // Delete organization
      await this.serviceRoleClient.from('organizations').delete().eq('id', orgId);
    }

    // Delete verification codes
    await this.serviceRoleClient.from('verification_codes').delete().eq('email', email);

    // Delete profile
    await this.serviceRoleClient.from('profiles').delete().eq('id', userId);

    // Delete auth user
    await this.serviceRoleClient.auth.admin.deleteUser(userId);

    console.log('[TestClient] Cleanup complete');
  }

  async createVerificationCode(email: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.serviceRoleClient.from('verification_codes').insert({
      email,
      code,
      type: 'email',
      expires_at: expiresAt.toISOString(),
    });

    return code;
  }

  async verifyCode(email: string, code: string): Promise<boolean> {
    const { data } = await this.serviceRoleClient
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', 'email')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    return !!data;
  }

  async getOrganizationByEmail(email: string) {
    const { data: profile } = await this.serviceRoleClient
      .from('profiles')
      .select('organization_id')
      .eq('email', email)
      .single();

    if (!profile?.organization_id) return null;

    const { data: organization } = await this.serviceRoleClient
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single();

    return organization;
  }

  async getSubscriptionByEmail(email: string) {
    const { data: profile } = await this.serviceRoleClient
      .from('profiles')
      .select('organization_id')
      .eq('email', email)
      .single();

    if (!profile?.organization_id) return null;

    const { data: subscription } = await this.serviceRoleClient
      .from('subscriptions')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single();

    return subscription;
  }

  async getUserRoleByEmail(email: string) {
    const { data: profile } = await this.serviceRoleClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) return null;

    const { data: role } = await this.serviceRoleClient
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle();

    return role?.role || null;
  }

  async getOrganizationAgent(organizationId: string) {
    const { data } = await this.serviceRoleClient
      .from('organization_agents')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    return data;
  }

  async waitForProfileCreation(userId: string, maxWaitMs = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const { data: profile } = await this.serviceRoleClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Update a user's subscription to a specific plan.
   * Used for testing different plan scenarios.
   */
  async updateSubscriptionPlan(email: string, plan: string, credits?: number): Promise<void> {
    const { data: profile } = await this.serviceRoleClient
      .from('profiles')
      .select('organization_id')
      .eq('email', email)
      .single();

    if (!profile?.organization_id) {
      throw new Error(`No organization found for email: ${email}`);
    }

    // Get the tier to get the correct credits
    const tier = await this.getSubscriptionTier(plan);
    const totalCredits = credits ?? tier?.credits ?? 250;

    const { error } = await this.serviceRoleClient
      .from('subscriptions')
      .update({
        plan,
        total_credits: totalCredits,
        used_credits: 0
      })
      .eq('organization_id', profile.organization_id);

    if (error) {
      throw new Error(`Failed to update subscription plan: ${error.message}`);
    }

    console.log(`[TestClient] Updated subscription to ${plan} plan with ${totalCredits} credits`);
  }

  /**
   * Get subscription tier details including feature flags.
   */
  async getSubscriptionTier(planId: string) {
    const { data, error } = await this.serviceRoleClient
      .from('subscription_tiers')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (error) {
      console.error(`[TestClient] Error fetching tier ${planId}:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * Get all subscription tiers.
   */
  async getAllSubscriptionTiers() {
    const { data, error } = await this.serviceRoleClient
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[TestClient] Error fetching tiers:', error.message);
      return [];
    }

    return data;
  }

  /**
   * Provision organization with a specific plan.
   * Wraps the provision-organization edge function call.
   */
  async provisionOrganizationWithPlan(
    accessToken: string,
    organizationName: string,
    notificationPhone: string,
    planId: string = 'core',
    timezone: string = 'America/New_York'
  ) {
    const { data, error } = await this.supabase.functions.invoke(
      'provision-organization',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          organizationName,
          notificationPhone,
          timezone,
          planId,
        },
      }
    );

    if (error) {
      throw new Error(`Provision failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a full test user with organization provisioned on a specific plan.
   * Returns the user data and session for further testing.
   */
  async createUserWithPlan(testUser: TestUser, plan: string = 'core') {
    // Sign up user
    const { data: authData, error: signUpError } = await this.supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        data: {
          full_name: testUser.name,
          organization_name: testUser.organizationName,
        },
      },
    });

    if (signUpError) {
      throw new Error(`Sign up failed: ${signUpError.message}`);
    }

    const userId = authData.user!.id;
    testUser.id = userId;

    // Wait for profile creation trigger
    await this.waitForProfileCreation(userId);

    // Sign in to get session
    const { data: sessionData, error: signInError } = await this.supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (signInError) {
      throw new Error(`Sign in failed: ${signInError.message}`);
    }

    // Provision organization with specified plan
    const provisionResult = await this.provisionOrganizationWithPlan(
      sessionData.session!.access_token,
      testUser.organizationName,
      testUser.phone,
      plan
    );

    return {
      user: authData.user,
      session: sessionData.session,
      organizationId: provisionResult.organizationId,
    };
  }
}
