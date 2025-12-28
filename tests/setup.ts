import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test environment variables
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Get service role key from docker container if needed
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Test Setup] SUPABASE_SERVICE_ROLE_KEY not set in environment');
}

beforeAll(() => {
  console.log('[Test Setup] Running integration tests against:', process.env.VITE_SUPABASE_URL);
});

afterAll(() => {
  console.log('[Test Setup] Test suite completed');
});
