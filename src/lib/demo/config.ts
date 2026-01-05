// Demo mode configuration
// Set VITE_DEMO_MODE=true to enable demo mode with mock data

export const isDemoMode = (): boolean => {
  return import.meta.env.VITE_DEMO_MODE === 'true';
};

export const DEMO_ACCOUNT_ID = 'demo-account-001';
export const DEMO_USER_ID = 'demo-user-001';
