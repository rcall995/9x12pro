/**
 * Resend Audiences Management
 * GET /api/resend/audiences - List all audiences
 * POST /api/resend/audiences - Create a new audience
 */

import { checkRateLimit } from '../lib/rate-limit.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_BASE = 'https://api.resend.com';

export default async function handler(req, res) {
  // Rate limit
  const rateLimited = checkRateLimit(req, res, { limit: 30, window: 60, keyPrefix: 'resend-audiences' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend API key not configured' });
  }

  try {
    if (req.method === 'GET') {
      // List all audiences
      const response = await fetch(`${RESEND_API_BASE}/audiences`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` }
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to fetch audiences' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      // Create a new audience
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Audience name required' });
      }

      const response = await fetch(`${RESEND_API_BASE}/audiences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message || 'Failed to create audience' });
      }

      const data = await response.json();
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Audiences API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
