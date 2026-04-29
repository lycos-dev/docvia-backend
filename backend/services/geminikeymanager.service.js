/**
 * GEMINI KEY MANAGER
 *
 * Drop-in replacement for groqkeymanager.service.js.
 * Reads all keys from GEMINI_API_KEY (comma-separated) in .env.
 * Assigns one key per user on registration (round-robin).
 * On every AI call, starts from the user's assigned key and automatically
 * cycles to the next key if rate-limited or otherwise unusable — trying all
 * available keys before giving up.
 *
 * .env format:
 *   GEMINI_API_KEY=key1,key2,key3,...
 *
 * Compatible with the same call signature as makeGroqCall so existing
 * controllers need zero changes:
 *   makeGeminiCall(userId, callFn, resolvedKeyIndex?)
 * where callFn is (apiKey: string) => Promise<any>
 */

'use strict';

const { supabase } = require('../config/supabase');

// ─── Parse keys from env ──────────────────────────────────────────────────────

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (GEMINI_KEYS.length === 0) {
  console.error('[GeminiKeyManager] ❌ No Gemini API keys found in GEMINI_API_KEY env var.');
} else {
  console.log(`[GeminiKeyManager] ✅ Loaded ${GEMINI_KEYS.length} Gemini key(s).`);
}

// ─── Assign a key to a new user ───────────────────────────────────────────────

async function assignKeyToUser(userId) {
  try {
    if (GEMINI_KEYS.length === 0) return;

    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[GeminiKeyManager] Count error:', countError.message);
      return;
    }

    const keyIndex = (count || 0) % GEMINI_KEYS.length;

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, groq_key_index: keyIndex }, // reuse same column — no schema change needed
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[GeminiKeyManager] Assign error:', error.message);
    } else {
      console.log(`[GeminiKeyManager] Assigned key index ${keyIndex} to user ${userId}`);
    }
  } catch (err) {
    console.error('[GeminiKeyManager] Unexpected error:', err.message);
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
      console.warn(`[GeminiKeyManager] No key index for user ${userId}, using index 0`);
      return 0;
    }

    return data.groq_key_index % GEMINI_KEYS.length;
  } catch (err) {
    console.error('[GeminiKeyManager] getUserKeyIndex error:', err.message);
    return 0;
  }
}

// Simple lookup (kept for backwards compat)
async function getKeyForUser(userId) {
  if (GEMINI_KEYS.length === 0) return undefined;
  const index = await getUserKeyIndex(userId);
  return GEMINI_KEYS[index];
}

// ─── Key-level failure detection ──────────────────────────────────────────────

function isKeyExhaustedError(err) {
  const msg    = (err?.message || '').toLowerCase();
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? 0;

  const isRateLimit = (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    status === 429
  );

  const isKeyFailure = (
    msg.includes('api_key_invalid') ||
    msg.includes('invalid api key') ||
    msg.includes('permission_denied') ||
    msg.includes('api key not valid') ||
    msg.includes('insufficient_quota') ||
    status === 401 ||
    status === 403
  );

  return isRateLimit || isKeyFailure;
}

function isQuotaExhausted(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('quota') && msg.includes('exceeded') || msg.includes('limit: 0');
}

const isRateLimitError = isKeyExhaustedError; // alias for backwards compat

// ─── Round-robin for stateless callers (OCR service) ─────────────────────────

let _rrIndex = 0;
function nextKey() {
  if (GEMINI_KEYS.length === 0) throw new Error('No Gemini API keys configured in GEMINI_API_KEY env var.');
  const key = GEMINI_KEYS[_rrIndex % GEMINI_KEYS.length];
  _rrIndex++;
  return key;
}

// ─── Main: call Gemini with automatic key cycling + retry ─────────────────────

/**
 * Executes callFn(apiKey) using the user's assigned starting key.
 * If that key is rate-limited/exhausted, cycles through all remaining keys.
 * Includes retry with exponential backoff for 429 errors.
 *
 * @param {string}   userId           - Used to resolve starting key index.
 * @param {Function} callFn           - (apiKey: string) => Promise<any>
 * @param {number}   [resolvedKeyIndex] - Pre-resolved index; skips DB lookup.
 */
async function makeGeminiCall(userId, callFn, resolvedKeyIndex) {
  if (GEMINI_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured.');
  }

  const startIndex = (resolvedKeyIndex != null && Number.isFinite(resolvedKeyIndex))
    ? resolvedKeyIndex % GEMINI_KEYS.length
    : await getUserKeyIndex(userId);

  // Retry with exponential backoff for quota errors
  const maxRetries = 3;
  let lastError = null;

  for (let retry = 0; retry <= maxRetries; retry++) {
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const index = (startIndex + i) % GEMINI_KEYS.length;
      const key   = GEMINI_KEYS[index];

      try {
        const result = await callFn(key);
        if (i > 0) {
          console.log(`[GeminiKeyManager] ✅ Succeeded with key index ${index} (after ${i} skip(s))`);
        }
        return result;
      } catch (err) {
        lastError = err;
        if (isKeyExhaustedError(err)) {
          if (i < GEMINI_KEYS.length - 1) {
            console.warn(`[GeminiKeyManager] ⚠️  Key index ${index} rate-limited — cycling...`);
            continue;
          } else {
            // All keys exhausted for this round - wait and retry
            if (retry < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, retry), 30000);
              console.warn(`[GeminiKeyManager] ⚠️  All keys rate-limited. Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              break; // Break inner loop to restart with all keys
            }
          }
        }
        throw err; // non-key error — propagate immediately
      }
    }
  }

  if (isQuotaExhausted(lastError)) {
    throw new Error('Gemini API quota exceeded. Please add more API keys in .env (comma-separated) or try again tomorrow.');
  }
  throw new Error('All Gemini API keys are currently exhausted. Please try again later.');
}

module.exports = {
  assignKeyToUser,
  getKeyForUser,
  getUserKeyIndex,
  makeGeminiCall,
  isRateLimitError,
  isKeyExhaustedError,
  GEMINI_KEYS,
  nextKey,
};