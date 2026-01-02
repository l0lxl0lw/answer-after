import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Browser client with safe fallbacks for environments where build-time VITE_* vars are missing.
// Publishable values are OK to ship; secrets must stay server-side.
const FALLBACK_URL = "https://gkomblopvuaxtenzjoni.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrb21ibG9wdnVheHRlbnpqb25pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODk5NDksImV4cCI6MjA4MTY2NTk0OX0.kL30a2YcWyksvNjrrWXgp7VgfbaOfmC9v29Rg6CSfNk";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
