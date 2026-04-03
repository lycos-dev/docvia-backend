/**
 * GROQ KEY MANAGER
 *
 * Reads all keys from GROQ_API_KEY (comma-separated) in .env.
 * Assigns one key per user on registration (round-robin).
 * On every AI call, starts from the user's assigned key and automatically
 * cycles to the next key if a 429 rate-limit error is encountered,
 * trying all available keys before giving up.
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

async function assignKeyToUser(userId) {
  try {
    if (GROQ_KEYS.length === 0) return;

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

// ─── Get a user's assigned starting key index ─────────────────────────────────

async function getUserKeyIndex(userId) {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('groq_key_index')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data || data.groq_key_index == null) {
      console.warn(`[GroqKeyManager] No key index for user ${userId}, using index 0`);
      return 0;
    }

    return data.groq_key_index % GROQ_KEYS.length;
  } catch (err) {
    console.error('[GroqKeyManager] getUserKeyIndex error:', err.message);
    return 0;
  }
}

// ─── Simple lookup (kept for backwards compat) ────────────────────────────────

async function getKeyForUser(userId) {
  if (GROQ_KEYS.length === 0) return undefined;
  const index = await getUserKeyIndex(userId);
  return GROQ_KEYS[index];
}

// ─── Rate-limit detection ─────────────────────────────────────────────────────

function isRateLimitError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate_limit_exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('tokens per day') ||
    msg.includes('tokens per minute')
  );
}

// ─── Main: call Groq with automatic key cycling on 429 ───────────────────────

/**
 * Executes callFn(apiKey) using the user's assigned key.
 * If that key returns a 429 rate-limit error, automatically tries the next
 * key in the pool, cycling through all available keys before throwing.
 *
 * Usage:
 *   const result = await makeGroqCall(userId, key =>
 *     new Groq({ apiKey: key }).chat.completions.create({ ... })
 *   );
 */
async function makeGroqCall(userId, callFn) {
  if (GROQ_KEYS.length === 0) {
    throw new Error('No Groq API keys configured.');
  }

  const startIndex = await getUserKeyIndex(userId);

  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const index = (startIndex + i) % GROQ_KEYS.length;
    const key   = GROQ_KEYS[index];

    try {
      const result = await callFn(key);
      if (i > 0) {
        console.log(`[GroqKeyManager] ✅ Succeeded with key index ${index} (after ${i} skip(s))`);
      }
      return result;
    } catch (err) {
      if (isRateLimitError(err)) {
        if (i < GROQ_KEYS.length - 1) {
          console.warn(`[GroqKeyManager] ⚠️  Key index ${index} rate-limited — cycling to next key...`);
          continue;
        } else {
          console.error('[GroqKeyManager] ❌ All keys are rate-limited.');
          throw new Error('All Groq API keys are currently rate-limited. Please try again later.');
        }
      }
      throw err;
    }
  }
}

module.exports = { assignKeyToUser, getKeyForUser, makeGroqCall, GROQ_KEYS };