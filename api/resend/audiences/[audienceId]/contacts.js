/**
 * Audience Contacts Management
 * GET /api/resend/audiences/[audienceId]/contacts - List contacts in audience
 */

import { checkRateLimit } from '../../../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';

export default async function handler(req, res) {
  const { audienceId } = req.query;

  if (!audienceId) {
    return res.status(400).json({ error: 'Audience ID required' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'resend-contacts' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  try {
    if (req.method === 'GET') {
      // List contacts in audience
      const response = await fetch(`${RESEND_API_BASE}/audiences/${audienceId}/contacts`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to fetch contacts' });
      }

      const data = await response.json();
      return res.status(200).json({ contacts: data.data || [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Contacts API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
