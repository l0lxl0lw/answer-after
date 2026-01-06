import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoMode } from '@/lib/demo/config';
import { DEMO_ACCOUNT_ID } from '@/lib/demo/config';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  campaign_type: string;
  agent_prompt: string | null;
  first_message: string | null;
  max_attempts: number;
  retry_delay_hours: number;
  start_date: string | null;
  end_date: string | null;
  calling_hours_start: string;
  calling_hours_end: string;
  calling_days: string[];
  timezone: string;
  total_contacts: number;
  contacts_called: number;
  contacts_connected: number;
  contacts_completed: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  agent_prompt?: string;
  first_message?: string;
  max_attempts?: number;
  retry_delay_hours?: number;
  calling_hours_start?: string;
  calling_hours_end?: string;
  calling_days?: string[];
  timezone?: string;
  contact_ids?: string[];
}

export interface UpdateCampaignInput {
  id: string;
  name?: string;
  description?: string;
  agent_prompt?: string;
  first_message?: string;
  max_attempts?: number;
  retry_delay_hours?: number;
  calling_hours_start?: string;
  calling_hours_end?: string;
  calling_days?: string[];
}

// Helper to generate dates relative to now
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

// Mock campaigns for demo mode
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'campaign-001',
    account_id: DEMO_ACCOUNT_ID,
    name: 'Appointment Reminder Campaign',
    description: 'Automated appointment reminders for scheduled services',
    status: 'active',
    campaign_type: 'reminder',
    agent_prompt: 'Remind customers about their upcoming appointment and confirm attendance.',
    first_message: 'Hi, this is Acme HVAC calling to remind you about your scheduled service appointment.',
    max_attempts: 3,
    retry_delay_hours: 24,
    start_date: daysAgo(14),
    end_date: null,
    calling_hours_start: '09:00',
    calling_hours_end: '18:00',
    calling_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'America/New_York',
    total_contacts: 48,
    contacts_called: 42,
    contacts_connected: 38,
    contacts_completed: 35,
    created_at: daysAgo(14),
    updated_at: daysAgo(1),
  },
  {
    id: 'campaign-002',
    account_id: DEMO_ACCOUNT_ID,
    name: 'Seasonal Maintenance Outreach',
    description: 'Reach out to past customers about seasonal HVAC maintenance',
    status: 'active',
    campaign_type: 'outreach',
    agent_prompt: 'Offer seasonal HVAC maintenance services to past customers.',
    first_message: 'Hi, this is Acme HVAC. We wanted to check in about scheduling your seasonal maintenance.',
    max_attempts: 2,
    retry_delay_hours: 48,
    start_date: daysAgo(7),
    end_date: daysFromNow(14),
    calling_hours_start: '10:00',
    calling_hours_end: '17:00',
    calling_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'America/New_York',
    total_contacts: 125,
    contacts_called: 67,
    contacts_connected: 52,
    contacts_completed: 45,
    created_at: daysAgo(7),
    updated_at: daysAgo(1),
  },
  {
    id: 'campaign-003',
    account_id: DEMO_ACCOUNT_ID,
    name: 'Service Follow-Up',
    description: 'Follow up with customers after service completion',
    status: 'paused',
    campaign_type: 'follow_up',
    agent_prompt: 'Thank customers for their business and ask about their satisfaction.',
    first_message: 'Hi, this is Acme HVAC following up on your recent service.',
    max_attempts: 2,
    retry_delay_hours: 72,
    start_date: daysAgo(21),
    end_date: null,
    calling_hours_start: '11:00',
    calling_hours_end: '16:00',
    calling_days: ['tuesday', 'wednesday', 'thursday'],
    timezone: 'America/New_York',
    total_contacts: 35,
    contacts_called: 35,
    contacts_connected: 28,
    contacts_completed: 28,
    created_at: daysAgo(21),
    updated_at: daysAgo(5),
  },
  {
    id: 'campaign-004',
    account_id: DEMO_ACCOUNT_ID,
    name: 'New Customer Welcome',
    description: 'Welcome new customers and introduce services',
    status: 'draft',
    campaign_type: 'welcome',
    agent_prompt: 'Welcome new customers and explain available services.',
    first_message: 'Hi, this is Acme HVAC. Thank you for choosing us!',
    max_attempts: 2,
    retry_delay_hours: 24,
    start_date: null,
    end_date: null,
    calling_hours_start: '09:00',
    calling_hours_end: '17:00',
    calling_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'America/New_York',
    total_contacts: 0,
    contacts_called: 0,
    contacts_connected: 0,
    contacts_completed: 0,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
];

export function useCampaigns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campaigns', user?.account_id],
    queryFn: async () => {
      if (isDemoMode()) {
        return MOCK_CAMPAIGNS;
      }

      if (!user?.account_id) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('account_id', user.account_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user?.account_id || isDemoMode(),
  });
}

export function useCampaign(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      if (!id || !user?.account_id) return null;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('account_id', user.account_id)
        .single();

      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!id && !!user?.account_id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!user?.account_id) throw new Error('No account');

      const { contact_ids, ...campaignData } = input;

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          account_id: user.account_id,
          ...campaignData,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Add contacts if provided
      if (contact_ids && contact_ids.length > 0) {
        const campaignContacts = contact_ids.map(contactId => ({
          campaign_id: campaign.id,
          contact_id: contactId,
        }));

        const { error: contactsError } = await supabase
          .from('campaign_contacts')
          .insert(campaignContacts);

        if (contactsError) throw contactsError;
      }

      return campaign as Campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('campaigns')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', data.id] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) => {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set start_date when activating
      if (status === 'active') {
        const { data: current } = await supabase
          .from('campaigns')
          .select('start_date')
          .eq('id', id)
          .single();

        if (!current?.start_date) {
          updates.start_date = new Date().toISOString();
        }
      }

      // Set end_date when completing
      if (status === 'completed') {
        updates.end_date = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', data.id] });
    },
  });
}
