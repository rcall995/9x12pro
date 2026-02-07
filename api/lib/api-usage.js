/**
 * API Usage Tracking - Auto-manages free tier limits
 * Tracks monthly usage per API and prevents exceeding quotas
 */

import { createClient } from '@supabase/supabase-js';

// API monthly limits (free tiers)
export const API_LIMITS = {
  brave: 2000,        // 2,000/month
  scrapingdog: 1000,  // 1,000 credits = 1,000 searches (using DuckDuckGo GWS at 1 credit each)
  serper: 2500,       // 2,500/month
  google_cse: 3000    // 100/day ≈ 3,000/month
};

// Buffer to stop before hitting exact limit (avoid overage charges)
const SAFETY_BUFFER = 50;

let supabase = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      supabase = createClient(url, key);
    }
  }
  return supabase;
}

/**
 * Get current month key (e.g., "2026-02")
 */
function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if API has available quota
 * @param {string} apiName - 'brave', 'serper', or 'google_cse'
 * @returns {Promise<{allowed: boolean, used: number, limit: number, remaining: number}>}
 */
export async function checkApiQuota(apiName) {
  const limit = API_LIMITS[apiName];
  if (!limit) {
    return { allowed: true, used: 0, limit: 0, remaining: Infinity };
  }

  const db = getSupabase();
  if (!db) {
    // If no database, allow but log warning
    console.warn(`⚠️ No database for quota tracking - allowing ${apiName}`);
    return { allowed: true, used: 0, limit, remaining: limit };
  }

  const monthKey = getMonthKey();

  try {
    const { data, error } = await db
      .from('api_usage')
      .select('calls_used')
      .eq('api_name', apiName)
      .eq('month_key', monthKey)
      .single();

    const used = data?.calls_used || 0;
    const effectiveLimit = limit - SAFETY_BUFFER;
    const remaining = Math.max(0, effectiveLimit - used);
    const allowed = used < effectiveLimit;

    return { allowed, used, limit, remaining };
  } catch (err) {
    // Table might not exist yet - allow and try to create
    console.warn(`⚠️ Quota check failed for ${apiName}:`, err.message);
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

/**
 * Record an API call
 * @param {string} apiName - 'brave', 'serper', or 'google_cse'
 * @returns {Promise<void>}
 */
export async function recordApiCall(apiName) {
  const db = getSupabase();
  if (!db) return;

  const monthKey = getMonthKey();

  try {
    // Upsert: insert or increment
    const { error } = await db.rpc('increment_api_usage', {
      p_api_name: apiName,
      p_month_key: monthKey
    });

    if (error) {
      // RPC might not exist - try direct upsert
      console.warn(`⚠️ RPC failed, trying direct upsert:`, error.message);

      const { data: existing } = await db
        .from('api_usage')
        .select('calls_used')
        .eq('api_name', apiName)
        .eq('month_key', monthKey)
        .single();

      if (existing) {
        await db
          .from('api_usage')
          .update({ calls_used: existing.calls_used + 1, updated_at: new Date().toISOString() })
          .eq('api_name', apiName)
          .eq('month_key', monthKey);
      } else {
        await db
          .from('api_usage')
          .insert({ api_name: apiName, month_key: monthKey, calls_used: 1 });
      }
    }
  } catch (err) {
    console.error(`⚠️ Failed to record API call for ${apiName}:`, err.message);
  }
}

/**
 * Get usage summary for all APIs
 * @returns {Promise<Object>}
 */
export async function getUsageSummary() {
  const db = getSupabase();
  if (!db) return {};

  const monthKey = getMonthKey();

  try {
    const { data, error } = await db
      .from('api_usage')
      .select('api_name, calls_used')
      .eq('month_key', monthKey);

    if (error) throw error;

    const summary = {};
    for (const [apiName, limit] of Object.entries(API_LIMITS)) {
      const record = data?.find(d => d.api_name === apiName);
      const used = record?.calls_used || 0;
      summary[apiName] = {
        used,
        limit,
        remaining: Math.max(0, limit - SAFETY_BUFFER - used),
        percentUsed: Math.round((used / limit) * 100)
      };
    }
    return summary;
  } catch (err) {
    console.error('⚠️ Failed to get usage summary:', err.message);
    return {};
  }
}
