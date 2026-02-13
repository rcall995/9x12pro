/**
 * Email Stats and Analytics
 * GET /api/resend/stats - Get email sending stats
 * GET /api/resend/stats?audienceId=xxx - Get audience-specific stats
 */

import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'resend-stats' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  const { audienceId } = req.query;

  try {
    const stats = {
      audiences: [],
      recentBroadcasts: [],
      totals: {
        contacts: 0,
        emailsSent: 0,
        audiences: 0
      }
    };

    // Get audiences from Resend
    const audiencesResponse = await fetch(`${RESEND_API_BASE}/audiences`, {
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
    });

    if (audiencesResponse.ok) {
      const audiencesData = await audiencesResponse.json();
      stats.audiences = audiencesData.data || [];
      stats.totals.audiences = stats.audiences.length;

      // Get contact counts for each audience
      for (const audience of stats.audiences) {
        try {
          const contactsResponse = await fetch(
            `${RESEND_API_BASE}/audiences/${audience.id}/contacts`,
            { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
          );
          if (contactsResponse.ok) {
            const contactsData = await contactsResponse.json();
            audience.contactCount = contactsData.data?.length || 0;
            stats.totals.contacts += audience.contactCount;
          }
        } catch (e) {
          audience.contactCount = 0;
        }
      }
    }

    // Get recent broadcasts from Supabase if available
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Get broadcasts
        let query = supabase
          .from('email_broadcasts')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(50);

        if (audienceId) {
          query = query.eq('audience_id', audienceId);
        }

        const { data: broadcasts } = await query;
        stats.recentBroadcasts = broadcasts || [];
        stats.totals.emailsSent = broadcasts?.length || 0;

        // Fetch engagement stats from broadcast_stats table
        if (broadcasts && broadcasts.length > 0) {
          const broadcastIds = broadcasts.map(b => b.resend_id).filter(Boolean);
          if (broadcastIds.length > 0) {
            const { data: engagementStats } = await supabase
              .from('broadcast_stats')
              .select('*')
              .in('broadcast_id', broadcastIds);

            if (engagementStats) {
              const statsMap = {};
              for (const s of engagementStats) {
                statsMap[s.broadcast_id] = s;
              }
              for (const b of stats.recentBroadcasts) {
                if (b.resend_id && statsMap[b.resend_id]) {
                  b.stats = statsMap[b.resend_id];
                }
              }
            }
          }
        }

        // Get sync history
        const { data: syncs } = await supabase
          .from('audience_syncs')
          .select('*')
          .order('synced_at', { ascending: false })
          .limit(10);

        stats.recentSyncs = syncs || [];

      } catch (e) {
        console.warn('Failed to get Supabase stats:', e.message);
      }
    }

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
}
