// AnswerAfter API Client
// Typed HTTP client for communicating with Express backend

import type { ApiResponse, ApiError } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestConfig extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
      }
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { body, params, headers: customHeaders, ...restConfig } = config;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...restConfig,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const json: ApiResponse<T> = await response.json();

    if (!response.ok || !json.success) {
      const error = json.error || { code: 'UNKNOWN', message: 'An unknown error occurred' };
      throw new ApiClientError(error.code, error.message, error.details);
    }

    return json.data as T;
  }

  // HTTP method shortcuts
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export error class for handling
export { ApiClientError };

// Type-safe API methods organized by domain
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiClient.post<import('@/types/api').LoginResponse>('/auth/login', { email, password }),
    
    register: (data: import('@/types/api').RegisterRequest) =>
      apiClient.post<import('@/types/api').LoginResponse>('/auth/register', data),
    
    logout: () => apiClient.post<void>('/auth/logout'),
    
    refresh: (refresh_token: string) =>
      apiClient.post<import('@/types/api').RefreshTokenResponse>('/auth/refresh', { refresh_token }),
    
    forgotPassword: (email: string) =>
      apiClient.post<void>('/auth/forgot-password', { email }),
    
    resetPassword: (token: string, password: string) =>
      apiClient.post<void>('/auth/reset-password', { token, password }),
  },

  // Organization
  organization: {
    get: (id: string) =>
      apiClient.get<import('@/types/database').Organization>(`/organizations/${id}`),
    
    update: (id: string, data: import('@/types/api').UpdateOrganizationRequest) =>
      apiClient.patch<import('@/types/database').Organization>(`/organizations/${id}`, data),
  },

  // Users
  users: {
    list: (params?: import('@/types/api').PaginationParams) =>
      apiClient.get<{ users: import('@/types/database').User[]; meta: import('@/types/api').PaginationMeta }>('/users', params as Record<string, string | number | boolean | undefined>),
    
    get: (id: string) =>
      apiClient.get<import('@/types/database').User>(`/users/${id}`),
    
    create: (data: import('@/types/api').CreateUserRequest) =>
      apiClient.post<import('@/types/database').User>('/users', data),
    
    update: (id: string, data: import('@/types/api').UpdateUserRequest) =>
      apiClient.patch<import('@/types/database').User>(`/users/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete<void>(`/users/${id}`),
    
    updateRole: (id: string, role: import('@/types/database').UserRole) =>
      apiClient.patch<void>(`/users/${id}/role`, { role }),
  },

  // Phone Numbers
  phoneNumbers: {
    list: () =>
      apiClient.get<import('@/types/database').PhoneNumber[]>('/phone-numbers'),
    
    getAvailable: (area_code: string) =>
      apiClient.get<import('@/types/api').AvailablePhoneNumber[]>('/phone-numbers/available', { area_code }),
    
    create: (data: import('@/types/api').CreatePhoneNumberRequest) =>
      apiClient.post<import('@/types/database').PhoneNumber>('/phone-numbers', data),
    
    update: (id: string, data: import('@/types/api').UpdatePhoneNumberRequest) =>
      apiClient.patch<import('@/types/database').PhoneNumber>(`/phone-numbers/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete<void>(`/phone-numbers/${id}`),
  },

  // Calls
  calls: {
    list: (params?: import('@/types/api').CallListParams) =>
      apiClient.get<import('@/types/api').CallListResponse>('/calls', params as Record<string, string | number | boolean | undefined>),
    
    get: (id: string) =>
      apiClient.get<import('@/types/database').CallWithDetails>(`/calls/${id}`),
  },

  // Appointments
  appointments: {
    list: (params?: import('@/types/api').AppointmentListParams) =>
      apiClient.get<{ appointments: import('@/types/database').Appointment[]; meta: import('@/types/api').PaginationMeta }>('/appointments', params as Record<string, string | number | boolean | undefined>),
    
    get: (id: string) =>
      apiClient.get<import('@/types/database').Appointment>(`/appointments/${id}`),
    
    create: (data: import('@/types/api').CreateAppointmentRequest) =>
      apiClient.post<import('@/types/database').Appointment>('/appointments', data),
    
    update: (id: string, data: import('@/types/api').UpdateAppointmentRequest) =>
      apiClient.patch<import('@/types/database').Appointment>(`/appointments/${id}`, data),
    
    delete: (id: string) =>
      apiClient.delete<void>(`/appointments/${id}`),
  },
  // Subscription
  subscription: {
    get: () =>
      apiClient.get<import('@/types/database').Subscription | null>('/subscription'),
    
    createCheckout: (data: import('@/types/api').CreateCheckoutSessionRequest) =>
      apiClient.post<import('@/types/api').CreateCheckoutSessionResponse>('/subscription/checkout', data),
    
    createPortal: (return_url: string) =>
      apiClient.post<import('@/types/api').CreatePortalSessionResponse>('/subscription/portal', { return_url }),
  },

  // Reports
  reports: {
    dashboard: () =>
      apiClient.get<import('@/types/database').DashboardStats>('/reports/dashboard'),
    
    daily: (date?: string) =>
      apiClient.get<import('@/types/api').DailyReportResponse>('/reports/daily', { date }),
    
    weekly: (week_start?: string) =>
      apiClient.get<import('@/types/api').DailyReportResponse>('/reports/weekly', { week_start }),
    
    monthly: (year: number, month: number) =>
      apiClient.get<import('@/types/api').DailyReportResponse>('/reports/monthly', { year, month }),
  },

  // Audit Logs
  auditLogs: {
    list: (params?: import('@/types/api').AuditLogListParams) =>
      apiClient.get<{ logs: import('@/types/database').AuditLog[]; meta: import('@/types/api').PaginationMeta }>('/audit-logs', params as Record<string, string | number | boolean | undefined>),
  },
};
