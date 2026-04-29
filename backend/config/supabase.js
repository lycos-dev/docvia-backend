const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials. Please check your .env file.\n' +
    'Required: SUPABASE_URL and SUPABASE_ANON_KEY'
  );
}

// ── Anon client ───────────────────────────────────────────────────────────────
// Used for auth operations (signUp, signInWithPassword, getUser, etc.)
// Subject to RLS — do NOT use for storage writes on behalf of OAuth users.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

// ── Service role client ───────────────────────────────────────────────────────
// Bypasses RLS — safe for server-side storage operations where the user is
// already authenticated via our own JWT middleware.
// NEVER expose the service role key to the frontend.
let supabaseAdmin = null;

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
  console.log('✅ Supabase admin (service role) client initialised.');
} else {
  console.warn(
    '⚠️  SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Google OAuth users will not be able to upload files. ' +
    'Add it to your .env file: Settings > API > service_role key.'
  );
}

// Test connection function
async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}

module.exports = { supabase, supabaseAdmin, testConnection };