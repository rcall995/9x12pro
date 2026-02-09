/**
 * Individual Audience Management
 * GET /api/resend/audiences/[audienceId] - Get audience details
 * DELETE /api/resend/audiences/[audienceId] - Delete an audience
 */

import { checkRateLimit } from '../../../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';

export default async function handler(req, res) {
  const { audienceId } = req.query;

  if (!audienceId) {
    return res.status(400).json({ error: 'Audience ID required' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'resend-audience' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  try {
    if (req.method === 'GET') {
      // Get audience details
      const response = await fetch(`${RESEND_API_BASE}/audiences/${audienceId}`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to fetch audience' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      // Delete audience
      const response = await fetch(`${RESEND_API_BASE}/audiences/${audienceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to delete audience' });
      }

      return res.status(200).json({ success: true, message: 'Audience deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Audience API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
