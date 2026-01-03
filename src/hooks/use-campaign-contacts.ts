import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: string;
  attempts: number;
  last_attempt_at: string | null;
  last_call_id: string | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined from contacts
  contact?: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
}

export function useCampaignContacts(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-contacts', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from('campaign_contacts')
        .select(`
          *,
          contact:contacts(id, name, phone, email)
        `)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CampaignContact[];
    },
    enabled: !!campaignId,
  });
}

export function useAddCampaignContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, contactIds }: { campaignId: string; contactIds: string[] }) => {
      const campaignContacts = contactIds.map(contactId => ({
        campaign_id: campaignId,
        contact_id: contactId,
      }));

      const { data, error } = await supabase
        .from('campaign_contacts')
        .upsert(campaignContacts, { onConflict: 'campaign_id,contact_id' })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useRemoveCampaignContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, contactId }: { campaignId: string; contactId: string }) => {
      const { error } = await supabase
        .from('campaign_contacts')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('contact_id', contactId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaignContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      campaignId,
      ...updates
    }: {
      id: string;
      campaignId: string;
      status?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('campaign_contacts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
