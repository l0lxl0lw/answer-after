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
}
