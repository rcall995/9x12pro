/**
 * Get user's subscription status
 * GET /api/square/subscription-status?email=user@example.com
 */

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../lib/rate-limit.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Plan features for reference
const PLAN_FEATURES = {
  free: {
    name: 'Free Trial',
    aiGenerations: 10,
    enrichments: 50,
    campaigns: 1
  },
  starter: {
    name: 'Starter',
    aiGenerations: 100,
    enrichments: 500,
    campaigns: 1
  },
  pro: {
    name: 'Professional',
    aiGenerations: 500,
    enrichments: 2000,
    campaigns: 5
  },
  enterprise: {
    name: 'Enterprise',
    aiGenerations: -1,
    enrichments: -1,
    campaigns: -1
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 30 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'subscription-status' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    // Get subscription from database
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_email', email)
      .eq('status', 'ACTIVE')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    // Get usage for current billing period
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_email', email)
      .gte('created_at', startOfMonth.toISOString())
      .single();

    // Determine plan
    const planId = subscription?.plan_id || 'free';
    const plan = PLAN_FEATURES[planId] || PLAN_FEATURES.free;

    // Calculate remaining quotas
    const currentUsage = {
      aiGenerations: usage?.ai_generations || 0,
      enrichments: usage?.enrichments || 0,
      campaigns: usage?.campaigns || 0
    };

    const remaining = {
      aiGenerations: plan.aiGenerations === -1 ? 'unlimited' : Math.max(0, plan.aiGenerations - currentUsage.aiGenerations),
      enrichments: plan.enrichments === -1 ? 'unlimited' : Math.max(0, plan.enrichments - currentUsage.enrichments),
      campaigns: plan.campaigns === -1 ? 'unlimited' : Math.max(0, plan.campaigns - currentUsage.campaigns)
    };

    return res.status(200).json({
      success: true,
      subscription: {
        planId,
        planName: plan.name,
        status: subscription?.status || 'TRIAL',
        startDate: subscription?.start_date || null,
        features: plan
      },
      usage: currentUsage,
      remaining,
      canUpgrade: planId !== 'enterprise'
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return res.status(500).json({
      error: 'Failed to get subscription status',
      details: error.message
    });
  }
}
