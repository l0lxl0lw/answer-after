import { beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Mock framer-motion to avoid jsdom issues with matchMedia
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    motion: {
      div: React.forwardRef((props: any, ref: any) =>
        React.createElement('div', { ...props, ref })),
      span: React.forwardRef((props: any, ref: any) =>
        React.createElement('span', { ...props, ref })),
      button: React.forwardRef((props: any, ref: any) =>
        React.createElement('button', { ...props, ref })),
      ul: React.forwardRef((props: any, ref: any) =>
        React.createElement('ul', { ...props, ref })),
      li: React.forwardRef((props: any, ref: any) =>
        React.createElement('li', { ...props, ref })),
      p: React.forwardRef((props: any, ref: any) =>
        React.createElement('p', { ...props, ref })),
      h1: React.forwardRef((props: any, ref: any) =>
        React.createElement('h1', { ...props, ref })),
      h2: React.forwardRef((props: any, ref: any) =>
        React.createElement('h2', { ...props, ref })),
      h3: React.forwardRef((props: any, ref: any) =>
        React.createElement('h3', { ...props, ref })),
    },
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({}),
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => 0,
    useSpring: () => 0,
    useInView: () => false,
  };
});

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test environment variables
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Get service role key from docker container if needed
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Test Setup] SUPABASE_SERVICE_ROLE_KEY not set in environment');
}

// Check if we're running UI/functionality tests (jsdom environment will have window defined)
const isJsdomTest = typeof window !== 'undefined';

if (isJsdomTest) {
  // Import RTL matchers for jsdom environment
  import('@testing-library/jest-dom');

  // Import cleanup from RTL
  const { cleanup } = await import('@testing-library/react');

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Create a proper matchMedia mock that framer-motion can use
  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia,
  });

  // Ensure matchMedia is also available on globalThis
  (globalThis as any).matchMedia = mockMatchMedia;

  // Mock window.scrollTo
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));
}

beforeAll(() => {
  if (!isJsdomTest) {
    console.log('[Test Setup] Running integration tests against:', process.env.VITE_SUPABASE_URL);
  }
});

afterAll(() => {
  if (!isJsdomTest) {
    console.log('[Test Setup] Test suite completed');
  }
});
