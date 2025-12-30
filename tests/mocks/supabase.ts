import { vi } from 'vitest';
import { mockSubscriptionTiers } from './mock-data';

// Create a chainable mock for Supabase query builder
const createQueryBuilder = (data: any = null, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  like: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  containedBy: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: vi.fn((resolve) => resolve({ data, error })),
});

// Mock data store for tests to configure
export const mockDataStore = {
  subscriptionTiers: [...mockSubscriptionTiers],
  subscriptions: [] as any[],
  phoneNumbers: [] as any[],
  services: [] as any[],
  organizationAgents: [] as any[],
  organizations: [] as any[],
  calls: [] as any[],
  callTranscripts: [] as any[],
};

// Reset mock data store
export const resetMockDataStore = () => {
  mockDataStore.subscriptionTiers = [...mockSubscriptionTiers];
  mockDataStore.subscriptions = [];
  mockDataStore.phoneNumbers = [];
  mockDataStore.services = [];
  mockDataStore.organizationAgents = [];
  mockDataStore.organizations = [];
  mockDataStore.calls = [];
  mockDataStore.callTranscripts = [];
};

// Configure what data a table returns
export const setMockTableData = (table: keyof typeof mockDataStore, data: any[]) => {
  mockDataStore[table] = data;
};

// Mock edge function responses
export const mockFunctionResponses: Record<string, { data?: any; error?: any }> = {};

export const setMockFunctionResponse = (functionName: string, response: { data?: any; error?: any }) => {
  mockFunctionResponses[functionName] = response;
};

export const resetMockFunctionResponses = () => {
  Object.keys(mockFunctionResponses).forEach((key) => delete mockFunctionResponses[key]);
};

// Create the Supabase mock
export const createSupabaseMock = () => {
  const functionsInvoke = vi.fn().mockImplementation((functionName: string) => {
    const response = mockFunctionResponses[functionName];
    if (response) {
      return Promise.resolve(response);
    }
    return Promise.resolve({ data: { success: true }, error: null });
  });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    // Return appropriate data based on table
    const getTableData = () => {
      switch (table) {
        case 'subscription_tiers':
          return mockDataStore.subscriptionTiers;
        case 'subscriptions':
          return mockDataStore.subscriptions[0] || null;
        case 'phone_numbers':
          return mockDataStore.phoneNumbers[0] || null;
        case 'services':
          return mockDataStore.services;
        case 'organization_agents':
          return mockDataStore.organizationAgents[0] || null;
        case 'organizations':
          return mockDataStore.organizations[0] || null;
        case 'calls':
          return mockDataStore.calls;
        case 'call_transcripts':
          return mockDataStore.callTranscripts;
        default:
          return null;
      }
    };

    const data = getTableData();
    return createQueryBuilder(data, null);
  });

  const channelMock = vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
    unsubscribe: vi.fn(),
  });

  const authMock = {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: Date.now() + 3600000,
          user: { id: 'user-123', email: 'test@example.com' },
        },
      },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-123' } },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-123' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  };

  return {
    from: fromMock,
    functions: {
      invoke: functionsInvoke,
    },
    auth: authMock,
    channel: channelMock,
    removeChannel: vi.fn(),
  };
};

// The actual mock to use in vi.mock
export const supabaseMock = createSupabaseMock();

// Helper to get mock function call info
export const getSupabaseMockCalls = () => ({
  from: supabaseMock.from.mock.calls,
  functionsInvoke: supabaseMock.functions.invoke.mock.calls,
});
