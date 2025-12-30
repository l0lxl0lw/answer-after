import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Use jsdom for UI and functionality tests, node for integration tests
    environmentMatchGlobs: [
      // UI tests use jsdom for React component testing
      ['tests/ui/**', 'jsdom'],
      // Functionality tests use jsdom for React component testing
      ['tests/functionality/**', 'jsdom'],
      // E2E tests use jsdom with real Supabase calls
      ['tests/e2e/**', 'jsdom'],
      // Integration tests use node
      ['tests/integration/**', 'node'],
    ],
    // Default to node for backwards compatibility
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Include all test directories
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
