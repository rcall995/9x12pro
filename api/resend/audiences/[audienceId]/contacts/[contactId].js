/**
 * Individual Contact Management
 * DELETE /api/resend/audiences/[audienceId]/contacts/[contactId] - Remove contact from audience
 */

import { checkRateLimit } from '../../../../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';

export default async function handler(req, res) {
  const { audienceId, contactId } = req.query;

  if (!audienceId || !contactId) {
    return res.status(400).json({ error: 'Audience ID and Contact ID required' });
  }

  const rateLimited = checkRateLimit(req, res, { limit: 60, window: 60, keyPrefix: 'resend-contact-delete' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  try {
    if (req.method === 'DELETE') {
      // Delete contact from audience
      const response = await fetch(`${RESEND_API_BASE}/audiences/${audienceId}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to delete contact' });
      }

      return res.status(200).json({ success: true, message: 'Contact removed from audience' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Contact delete API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
