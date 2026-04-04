import { createClient } from '@supabase/supabase-js';

// Get Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://unqrpabmiokotjrznagf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucXJwYWJtaW9rb3RqcnpuYWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTgxOTUsImV4cCI6MjA4NTY3NDE5NX0.5YIAjGUsLPcmMPy_vtOwKlvs859EC5dZXxSlPi5anz4';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials are not properly configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

/**
 * Initialize Supabase client
 * Used for OAuth flows and session management
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
