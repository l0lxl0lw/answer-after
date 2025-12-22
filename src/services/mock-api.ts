// AnswerAfter Mock API Service
// Simulates backend API for development

import type {
  Organization,
  User,
  UserRole,
  PhoneNumber,
  Call,
  CallWithDetails,
  Technician,
  TechnicianWithSchedule,
  OnCallSchedule,
  Appointment,
  Subscription,
  DashboardStats,
  AuditLog,
} from '@/types/database';
import type {
  LoginResponse,
  RegisterRequest,
  PaginationMeta,
  CallListParams,
  CallListResponse,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  CreateTechnicianRequest,
  UpdateTechnicianRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  DailyReportResponse,
} from '@/types/api';
import {
  mockOrganization,
  mockUsers,
  mockUserRoles,
  mockPhoneNumbers,
  mockCalls,
  mockCallWithDetails,
  mockTechnicians,
  mockTechniciansWithSchedules,
  mockSchedules,
  mockAppointments,
  mockSubscription,
  mockDashboardStats,
  mockCallsByHour,
  mockCallsByOutcome,
  mockAuditLogs,
  mockCallEvents,
  mockCallTranscripts,
} from '@/lib/mock-data';

// Simulate network delay
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Generate pagination meta
const paginate = <T>(items: T[], page = 1, perPage = 10): { items: T[]; meta: PaginationMeta } => {
  const start = (page - 1) * perPage;
  const paginatedItems = items.slice(start, start + perPage);
  return {
    items: paginatedItems,
    meta: {
      page,
      per_page: perPage,
      total: items.length,
      total_pages: Math.ceil(items.length / perPage),
    },
  };
};

// In-memory state for mutations (would be replaced by real API)
let currentUser: User | null = null;
let currentRole: UserRole | null = null;

export const mockApi = {
  // ============= Auth =============
  auth: {
    async login(email: string, _password: string): Promise<LoginResponse> {
      await delay();
      const user = mockUsers.find(u => u.email === email);
      if (!user) {
        throw new Error('Invalid credentials');
      }
      currentUser = user;
      currentRole = mockUserRoles[user.id];
      return {
        user,
        role: currentRole,
        organization: mockOrganization,
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async register(data: RegisterRequest): Promise<LoginResponse> {
      await delay();
      const newUser: User = {
        id: 'user_new_' + Date.now(),
        organization_id: 'org_new_' + Date.now(),
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const newOrg: Organization = {
        ...mockOrganization,
        id: 'org_new_' + Date.now(),
        name: data.organization_name,
        slug: data.organization_name.toLowerCase().replace(/\s+/g, '-'),
      };
      currentUser = newUser;
      currentRole = 'owner';
      return {
        user: newUser,
        role: 'owner',
        organization: newOrg,
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    },

    async logout(): Promise<void> {
      await delay(100);
      currentUser = null;
      currentRole = null;
    },

    async getCurrentUser(): Promise<{ user: User; role: UserRole; organization: Organization } | null> {
      await delay(100);
      if (!currentUser) return null;
      return {
        user: currentUser,
        role: currentRole!,
        organization: mockOrganization,
      };
    },
  },

  // ============= Organization =============
  organization: {
    async get(): Promise<Organization> {
      await delay();
      return mockOrganization;
    },

    async update(data: Partial<Organization>): Promise<Organization> {
      await delay();
      return { ...mockOrganization, ...data, updated_at: new Date().toISOString() };
    },
  },

  // ============= Users =============
  users: {
    async list(page = 1, perPage = 10): Promise<{ users: User[]; meta: PaginationMeta }> {
      await delay();
      const { items, meta } = paginate(mockUsers, page, perPage);
      return { users: items, meta };
    },

    async get(id: string): Promise<User> {
      await delay();
      const user = mockUsers.find(u => u.id === id);
      if (!user) throw new Error('User not found');
      return user;
    },
  },

  // ============= Phone Numbers =============
  phoneNumbers: {
    async list(): Promise<PhoneNumber[]> {
      await delay();
      return mockPhoneNumbers;
    },
  },

  // ============= Calls =============
  calls: {
    async list(params?: CallListParams): Promise<CallListResponse> {
      await delay();
      let filtered = [...mockCalls];
      
      if (params?.outcome) {
        filtered = filtered.filter(c => c.outcome === params.outcome);
      }
      if (params?.search) {
        const search = params.search.toLowerCase();
        filtered = filtered.filter(c => 
          c.caller_name?.toLowerCase().includes(search) ||
          c.caller_phone.includes(search) ||
          c.summary?.toLowerCase().includes(search)
        );
      }

      const { items, meta } = paginate(filtered, params?.page, params?.per_page);
      return { calls: items, meta };
    },

    async get(id: string): Promise<CallWithDetails> {
      await delay();
      const call = mockCalls.find(c => c.id === id);
      if (!call) throw new Error('Call not found');
      
      // Return full details for the first call, basic for others
      if (id === 'call_01') {
        return mockCallWithDetails;
      }
      
      return {
        ...call,
        phone_number: mockPhoneNumbers[0],
        events: mockCallEvents.map(e => ({ ...e, call_id: id })),
        transcripts: mockCallTranscripts.map(t => ({ ...t, call_id: id })),
      };
    },
  },

  // ============= Appointments =============
  appointments: {
    async list(page = 1, perPage = 10): Promise<{ appointments: Appointment[]; meta: PaginationMeta }> {
      await delay();
      const { items, meta } = paginate(mockAppointments, page, perPage);
      return { appointments: items, meta };
    },

    async get(id: string): Promise<Appointment> {
      await delay();
      const apt = mockAppointments.find(a => a.id === id);
      if (!apt) throw new Error('Appointment not found');
      return apt;
    },

    async create(data: CreateAppointmentRequest): Promise<Appointment> {
      await delay();
      const newApt: Appointment = {
        id: 'apt_new_' + Date.now(),
        organization_id: 'org_01',
        call_id: data.call_id || null,
        technician_id: data.technician_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address || null,
        issue_description: data.issue_description,
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
        status: 'scheduled',
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return newApt;
    },

    async update(id: string, data: UpdateAppointmentRequest): Promise<Appointment> {
      await delay();
      const apt = mockAppointments.find(a => a.id === id);
      if (!apt) throw new Error('Appointment not found');
      return { ...apt, ...data, updated_at: new Date().toISOString() };
    },
  },

  // ============= Technicians =============
  technicians: {
    async list(): Promise<TechnicianWithSchedule[]> {
      await delay();
      return mockTechniciansWithSchedules;
    },

    async get(id: string): Promise<TechnicianWithSchedule> {
      await delay();
      const tech = mockTechniciansWithSchedules.find(t => t.id === id);
      if (!tech) throw new Error('Technician not found');
      return tech;
    },

    async create(data: CreateTechnicianRequest): Promise<Technician> {
      await delay();
      const newTech: Technician = {
        id: 'tech_new_' + Date.now(),
        organization_id: 'org_01',
        user_id: data.user_id || null,
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || null,
        specializations: data.specializations || [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return newTech;
    },

    async update(id: string, data: UpdateTechnicianRequest): Promise<Technician> {
      await delay();
      const tech = mockTechnicians.find(t => t.id === id);
      if (!tech) throw new Error('Technician not found');
      return { ...tech, ...data, updated_at: new Date().toISOString() };
    },
  },

  // ============= Schedules =============
  schedules: {
    async list(): Promise<OnCallSchedule[]> {
      await delay();
      return mockSchedules;
    },

    async getCurrent(): Promise<{ primary: TechnicianWithSchedule | null; backup: TechnicianWithSchedule | null }> {
      await delay();
      const primary = mockTechniciansWithSchedules.find(t => 
        t.schedules.some(s => s.is_primary)
      ) || null;
      const backup = mockTechniciansWithSchedules.find(t => 
        t.schedules.some(s => !s.is_primary)
      ) || null;
      return { primary, backup };
    },

    async create(data: CreateScheduleRequest): Promise<OnCallSchedule> {
      await delay();
      const newSchedule: OnCallSchedule = {
        id: 'schedule_new_' + Date.now(),
        organization_id: 'org_01',
        technician_id: data.technician_id,
        start_datetime: data.start_datetime,
        end_datetime: data.end_datetime,
        is_primary: data.is_primary || false,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return newSchedule;
    },

    async update(id: string, data: UpdateScheduleRequest): Promise<OnCallSchedule> {
      await delay();
      const schedule = mockSchedules.find(s => s.id === id);
      if (!schedule) throw new Error('Schedule not found');
      return { ...schedule, ...data, updated_at: new Date().toISOString() };
    },
  },

  // ============= Subscription =============
  subscription: {
    async get(): Promise<Subscription | null> {
      await delay();
      return mockSubscription;
    },

    async createCheckout(): Promise<{ checkout_url: string; session_id: string }> {
      await delay();
      return {
        checkout_url: 'https://checkout.stripe.com/mock-session',
        session_id: 'cs_mock_' + Date.now(),
      };
    },

    async createPortal(): Promise<{ portal_url: string }> {
      await delay();
      return {
        portal_url: 'https://billing.stripe.com/mock-portal',
      };
    },
  },

  // ============= Reports =============
  reports: {
    async dashboard(): Promise<DashboardStats> {
      await delay();
      return mockDashboardStats;
    },

    async daily(): Promise<DailyReportResponse> {
      await delay();
      return {
        date: new Date().toISOString().split('T')[0],
        stats: mockDashboardStats,
        calls_by_hour: mockCallsByHour,
        calls_by_outcome: mockCallsByOutcome,
        top_issues: [
          { issue: 'Heating failure', count: 8 },
          { issue: 'AC not cooling', count: 6 },
          { issue: 'Strange noises', count: 4 },
          { issue: 'Thermostat issues', count: 3 },
          { issue: 'Gas smell', count: 2 },
        ],
        notable_calls: mockCalls.filter(c => c.outcome === 'booked'),
      };
    },
  },

  // ============= Audit Logs =============
  auditLogs: {
    async list(page = 1, perPage = 20): Promise<{ logs: AuditLog[]; meta: PaginationMeta }> {
      await delay();
      const { items, meta } = paginate(mockAuditLogs, page, perPage);
      return { logs: items, meta };
    },
  },
};
