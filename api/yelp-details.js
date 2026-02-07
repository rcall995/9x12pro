// Vercel Serverless Function - Yelp Business Details
// Get detailed info including website, hours, photos
// Docs: https://docs.developer.yelp.com/reference/v3_business_info

import { checkRateLimit } from './lib/rate-limit.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 50 requests per minute
  const rateLimited = checkRateLimit(req, res, { limit: 50, window: 60, keyPrefix: 'yelp-details' });
  if (rateLimited) {
    return res.status(rateLimited.status).json(rateLimited.body);
  }

  const { yelp_id } = req.body;

  if (!yelp_id) {
    return res.status(400).json({ error: 'yelp_id parameter required' });
  }

  const YELP_API_KEY = process.env.YELP_API_KEY;

  if (!YELP_API_KEY) {
    return res.status(500).json({
      error: 'Yelp API key not configured'
    });
  }

  try {
    const url = `https://api.yelp.com/v3/businesses/${yelp_id}`;

    console.log('🔍 Fetching Yelp business details:', yelp_id);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yelp Details API error:', errorText);
      return res.status(response.status).json({
        error: 'Yelp API request failed',
        details: errorText
      });
    }

    const data = await response.json();

    console.log('✅ Yelp details retrieved for:', data.name);

    // Extract enriched data
    const enrichedData = {
      phone: data.display_phone || data.phone || '',
      website: '', // Yelp doesn't provide actual business website in API
      email: '', // Not available from Yelp
      hours: data.hours || [],
      photos: data.photos || [],
      transactions: data.transactions || [],
      messaging: data.messaging || {},
      yelp_url: data.url || '',
      enriched: !!(data.phone || data.url),
      source: 'yelp_details',
      cost: 0
    };

    return res.status(200).json(enrichedData);

  } catch (error) {
    console.error('Yelp details proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
