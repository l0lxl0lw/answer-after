import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

export function useCampaigns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['campaigns', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('account_id', user.account_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user?.account_id,
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
