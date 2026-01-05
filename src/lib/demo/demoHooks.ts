// Demo hooks - Return mock data for demo mode
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  mockCalls,
  mockContacts,
  mockAppointments,
  mockServices,
  mockSubscription,
  mockPhoneNumbers,
  mockCallIntakes,
  mockAccount,
  generateMockDashboardStats,
} from './mockData';
import type { DashboardPeriod } from '@/hooks/use-dashboard';
import type { ContactFilters } from '@/hooks/use-contacts';
import type { Contact, ContactStatus, ContactSource, InterestLevel, LeadStatus } from '@/types/database';

// Demo Dashboard Stats
export function useDemoDashboardStats(period: DashboardPeriod = '7d') {
  return useQuery({
    queryKey: ['demo', 'dashboard', 'stats', period],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      return generateMockDashboardStats(period);
    },
  });
}

// Demo Call History
export function useDemoCallHistory(params?: { search?: string; page?: number; per_page?: number }) {
  const page = params?.page || 1;
  const perPage = params?.per_page || 20;

  return useQuery({
    queryKey: ['demo', 'call-history', params],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      let filteredCalls = [...mockCalls];

      if (params?.search) {
        const search = params.search.toLowerCase();
        filteredCalls = filteredCalls.filter(c =>
          c.caller_phone.includes(search) ||
          c.caller_name?.toLowerCase().includes(search) ||
          c.summary?.toLowerCase().includes(search)
        );
      }

      // Sort by date descending
      filteredCalls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      const from = (page - 1) * perPage;
      const to = from + perPage;
      const paginatedCalls = filteredCalls.slice(from, to);

      return {
        calls: paginatedCalls.map(c => ({
          ...c,
          contact: c.contact_id ? mockContacts.find(ct => ct.id === c.contact_id) : null,
        })),
        total: filteredCalls.length,
        page,
        per_page: perPage,
      };
    },
  });
}

// Demo Contacts
export function useDemoContacts(filters: ContactFilters = {}, page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['demo', 'contacts', filters, page, perPage],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      let filteredContacts = [...mockContacts];

      if (filters.status && filters.status !== 'all') {
        filteredContacts = filteredContacts.filter(c => c.status === filters.status);
      }
      if (filters.interest_level && filters.interest_level !== 'all') {
        filteredContacts = filteredContacts.filter(c => c.interest_level === filters.interest_level);
      }
      if (filters.lead_status && filters.lead_status !== 'all') {
        filteredContacts = filteredContacts.filter(c => c.lead_status === filters.lead_status);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filteredContacts = filteredContacts.filter(c =>
          c.name?.toLowerCase().includes(search) ||
          c.phone.includes(search) ||
          c.email?.toLowerCase().includes(search)
        );
      }

      const from = (page - 1) * perPage;
      const to = from + perPage;

      const stats = {
        total: filteredContacts.length,
        hot: filteredContacts.filter(c => c.interest_level === 'hot').length,
        warm: filteredContacts.filter(c => c.interest_level === 'warm').length,
        cold: filteredContacts.filter(c => c.interest_level === 'cold').length,
      };

      return {
        contacts: filteredContacts.slice(from, to),
        meta: {
          page,
          per_page: perPage,
          total: filteredContacts.length,
          total_pages: Math.ceil(filteredContacts.length / perPage),
        },
        stats,
      };
    },
  });
}

// Demo Leads
export function useDemoLeads(filters: Omit<ContactFilters, 'status'> = {}, page = 1, perPage = 20) {
  return useDemoContacts({ ...filters, status: 'lead' }, page, perPage);
}

// Demo Customers
export function useDemoCustomers(filters: Omit<ContactFilters, 'status'> = {}, page = 1, perPage = 20) {
  return useDemoContacts({ ...filters, status: 'customer' }, page, perPage);
}

// Demo Contact by ID
export function useDemoContact(id: string) {
  return useQuery({
    queryKey: ['demo', 'contacts', id],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return mockContacts.find(c => c.id === id) || null;
    },
    enabled: !!id,
  });
}

// Demo Create Contact
export function useDemoCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      phone: string;
      name?: string;
      email?: string;
      address?: string;
      notes?: string;
      status?: ContactStatus;
      source?: ContactSource;
    }) => {
      await new Promise(resolve => setTimeout(resolve, 300));

      const newContact: Contact = {
        id: `contact-${Date.now()}`,
        account_id: mockAccount.id,
        phone: data.phone,
        name: data.name || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
        status: data.status || 'customer',
        source: data.source || 'manual',
        interest_level: null,
        lead_status: 'new',
        lead_notes: null,
        lead_updated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockContacts.unshift(newContact);
      return newContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo', 'contacts'] });
    },
  });
}

// Demo Update Contact
export function useDemoUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      email?: string;
      address?: string;
      notes?: string;
      status?: ContactStatus;
      interest_level?: InterestLevel;
      lead_status?: LeadStatus;
      lead_notes?: string;
    }) => {
      await new Promise(resolve => setTimeout(resolve, 300));

      const index = mockContacts.findIndex(c => c.id === id);
      if (index === -1) throw new Error('Contact not found');

      const updated = { ...mockContacts[index], ...data, updated_at: new Date().toISOString() };
      mockContacts[index] = updated;
      return updated;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['demo', 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['demo', 'contacts', id] });
    },
  });
}

// Demo Delete Contact
export function useDemoDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      const index = mockContacts.findIndex(c => c.id === id);
      if (index !== -1) {
        mockContacts.splice(index, 1);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo', 'contacts'] });
    },
  });
}

// Demo Appointments
export function useDemoAppointments(params?: { page?: number; per_page?: number }) {
  const page = params?.page || 1;
  const perPage = params?.per_page || 20;

  return useQuery({
    queryKey: ['demo', 'appointments', params],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const sorted = [...mockAppointments].sort(
        (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()
      );

      const from = (page - 1) * perPage;
      const to = from + perPage;

      return {
        appointments: sorted.slice(from, to),
        meta: {
          page,
          per_page: perPage,
          total: mockAppointments.length,
          total_pages: Math.ceil(mockAppointments.length / perPage),
        },
      };
    },
  });
}

// Demo Services
export function useDemoServices() {
  return useQuery({
    queryKey: ['demo', 'services'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockServices;
    },
  });
}

// Demo Phone Numbers
export function useDemoPhoneNumbers() {
  return useQuery({
    queryKey: ['demo', 'phone-numbers'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return mockPhoneNumbers;
    },
  });
}

// Demo Subscription
export function useDemoSubscription() {
  return useQuery({
    queryKey: ['demo', 'subscription'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return mockSubscription;
    },
  });
}

// Demo Account
export function useDemoAccount() {
  return useQuery({
    queryKey: ['demo', 'account'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return mockAccount;
    },
  });
}

// Demo Call Intakes
export function useDemoCallIntakes() {
  return useQuery({
    queryKey: ['demo', 'call-intakes'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return mockCallIntakes;
    },
  });
}

// Demo Recent Calls
export function useDemoRecentCalls(limit = 5) {
  return useQuery({
    queryKey: ['demo', 'calls', 'recent', limit],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      const sorted = [...mockCalls].sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      );
      return sorted.slice(0, limit);
    },
  });
}

// Demo Credits (mock)
export function useDemoCredits() {
  return useQuery({
    queryKey: ['demo', 'credits'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        total: 1000,
        used: 247,
        remaining: 753,
      };
    },
  });
}
