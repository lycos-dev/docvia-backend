/**
 * GROQ KEY MANAGER
 *
 * Reads all keys from GROQ_API_KEY (comma-separated) in .env.
 * Assigns one key per user on registration (round-robin).
 * Looks up a user's assigned key for every AI call.
 *
 * .env format:
 *   GROQ_API_KEY=key1,key2,key3,...
 */

const { supabase } = require('../config/supabase');

// ─── Parse keys from env ──────────────────────────────────────────────────────

const GROQ_KEYS = (process.env.GROQ_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (GROQ_KEYS.length === 0) {
  console.error('[GroqKeyManager] ❌ No Groq API keys found in GROQ_API_KEY env var.');
} else {
  console.log(`[GroqKeyManager] ✅ Loaded ${GROQ_KEYS.length} Groq key(s).`);
}

// ─── Assign a key to a new user ───────────────────────────────────────────────

/**
 * Called on user registration.
 * Counts existing user_profiles rows to pick the next key in rotation,
 * then upserts a profile row with that key index.
 */
async function assignKeyToUser(userId) {
  try {
    if (GROQ_KEYS.length === 0) return;

    // Count how many profiles already exist to determine next index
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[GroqKeyManager] Count error:', countError.message);
      return;
    }

    const keyIndex = (count || 0) % GROQ_KEYS.length;

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, groq_key_index: keyIndex },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[GroqKeyManager] Assign error:', error.message);
    } else {
      console.log(`[GroqKeyManager] Assigned key index ${keyIndex} to user ${userId}`);
    }
  } catch (err) {
    console.error('[GroqKeyManager] Unexpected error:', err.message);
  }
}

// ─── Get a user's assigned key ────────────────────────────────────────────────

/**
 * Returns the Groq API key assigned to this user.
 * Falls back to key[0] if no profile row exists.
 */
async function getKeyForUser(userId) {
  if (GROQ_KEYS.length === 0) return undefined;
  if (!userId) return GROQ_KEYS[0];

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('groq_key_index')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data || data.groq_key_index == null) {
      console.warn(`[GroqKeyManager] No key index for user ${userId}, using key[0]`);
      return GROQ_KEYS[0];
    }

    const index = data.groq_key_index % GROQ_KEYS.length;
    return GROQ_KEYS[index];
  } catch (err) {
    console.error('[GroqKeyManager] getKeyForUser error:', err.message);
    return GROQ_KEYS[0];
  }
}

module.exports = { assignKeyToUser, getKeyForUser, GROQ_KEYS };